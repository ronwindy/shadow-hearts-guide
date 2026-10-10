#!/usr/bin/env python3
"""
pipeline.py - Unified Guide Pipeline CLI & Orchestrator

Consolidates scaffolding, schema validation, QA verification, frontend auditing,
and status tracking for the Shadow Hearts Game Guide conversion project.

Usage:
    python scripts/pipeline.py <section_id> --scaffold   # Generate structured draft from canonical
    python scripts/pipeline.py <section_id> --validate   # Validate structured JSON against schema
    python scripts/pipeline.py <section_id> --qa         # Run QA verification and record result in qa-status.json
    python scripts/pipeline.py <section_id> --verify     # Validate + QA + Build + Update status
    python scripts/pipeline.py <section_id> --frontend   # Run frontend/UX audit
    python scripts/pipeline.py [<section_id>] --lint     # Presentation lint (prose blocks, UPPERCASE item tags, [_TAG_], ASCII borders)
    python scripts/pipeline.py <section_id> --verdict F  # Validate + store the independent QA subagent's JSON verdict (F = "-" reads stdin); records the structured file hash so --check/--finalize warn on a stale verdict
    python scripts/pipeline.py <section_id> --qa-subagent-prompt  # Print the independent QA subagent prompt + verdict path
    python scripts/pipeline.py <section_id> --finalize   # Stage exactly this section's files (no commit); prints the commit message
    python scripts/pipeline.py <section_id> --check      # Lean per-section check: validate + QA + build + status
    python scripts/pipeline.py <section_id> --full       # Full check: --check + frontend audit (run every ~5 sections or after UI/code changes)
    python scripts/pipeline.py <section_id>              # Display section status
    python scripts/pipeline.py --backlog                 # Run QA on all structured guides lacking a current result
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parent.parent

# Add skill script directories to sys.path for direct imports
sys.path.insert(0, str(ROOT_DIR / ".claude" / "skills" / "guide-transformer" / "scripts"))
sys.path.insert(0, str(ROOT_DIR / ".claude" / "skills" / "qa" / "scripts"))
sys.path.insert(0, str(ROOT_DIR / ".claude" / "skills" / "frontend-expert" / "scripts"))
sys.path.insert(0, str(ROOT_DIR / "scripts"))

try:
    from scaffold_structured_guide import scaffold_guide
    from validate_guide import load_schema, validate_file
    from verify_guide import verify_guide, format_markdown_report
    from audit_frontend import audit_astro_sources, audit_built_html
    from lint_guide import lint_guide
    import status as status_module
    from jsonschema import Draft202012Validator
except ImportError as err:
    print(f"[ERROR] Failed importing internal pipeline modules: {err}")
    sys.exit(1)


def get_canonical_manifest() -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    manifest_path = ROOT_DIR / "canonical-sources" / "shadow-hearts-guide.canonical.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Canonical manifest not found: {manifest_path}")
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("source", {}), data.get("sections_index", [])


def resolve_section(identifier: str) -> Optional[Dict[str, Any]]:
    """Resolves a section by id (e.g. w-1-04), code (e.g. [W-1-04]), file stem, or filename."""
    _, sections = get_canonical_manifest()
    clean_id = identifier.strip().lower()
    clean_id_no_code = clean_id.strip("[]")

    for sec in sections:
        sec_id = sec.get("id", "").lower()
        sec_code = sec.get("code", "").lower().strip("[]")
        rel_file = sec.get("file", "")
        file_name = Path(rel_file).name.lower()
        file_stem = Path(rel_file).stem.lower()

        if (clean_id == sec_id or
            clean_id_no_code == sec_code or
            clean_id == file_stem or
            clean_id == file_name or
            clean_id in file_stem):
            return sec

    return None


def get_section_paths(sec: Dict[str, Any]) -> Tuple[Path, Path]:
    """Returns (canonical_path, structured_path)."""
    rel_canonical = sec.get("file", "")
    filename = Path(rel_canonical).name if rel_canonical else f"{sec['id']}.json"
    
    canonical_path = ROOT_DIR / "canonical-sources" / rel_canonical
    structured_path = ROOT_DIR / "structured-content" / "sections" / filename

    return canonical_path, structured_path


def run_scaffold(sec: Dict[str, Any], force: bool = False) -> bool:
    """Scaffolds a structured guide JSON draft from the canonical source text."""
    canonical_path, structured_path = get_section_paths(sec)
    print(f"\n--- [1/1] Scaffolding: {sec['id']} ({sec.get('title')}) ---")
    
    if not canonical_path.exists():
        print(f"[FAIL] Canonical file not found: {canonical_path}")
        return False
        
    if structured_path.exists() and not force:
        print(f"[WARN] Structured file already exists: {structured_path}")
        print("Use --force to overwrite if desired.")
        return True

    try:
        scaffolded = scaffold_guide(str(canonical_path))
        structured_path.parent.mkdir(parents=True, exist_ok=True)
        with open(structured_path, "w", encoding="utf-8") as f:
            json.dump(scaffolded, f, indent=2, ensure_ascii=False)
        print(f"[PASS] Successfully scaffolded: {structured_path.relative_to(ROOT_DIR)}")
        report_scaffold_warnings(sec, scaffolded)
        return True
    except Exception as e:
        print(f"[FAIL] Scaffolding failed: {e}")
        return False


def report_scaffold_warnings(sec: Dict[str, Any], scaffolded: Dict[str, Any]) -> None:
    """Flags a scaffold that probably needs a hand-written patch (fragments, guessed step types).

    The scaffold is a draft: fragments and fallback step types are printed, never fatal.
    """
    guide = scaffolded.get("guide", {})
    warns = [f for f in lint_guide(guide) if f["severity"] == "warn" and f["check"] in ("fragment", "mixed-list")]
    for f in warns:
        print(f"  [WARN] {f['check']:<10} {f['location']}: {f['text']}")
    guessed = [str(st["id"]) for st in guide.get("steps", [])
               if st.get("type") == "exploration"
               or (st.get("type") == "battle" and not st.get("encounter") and not st.get("boss"))]
    if guessed:
        print(f"  [WARN] low-confidence step type (fallback 'exploration' or 'battle' with no encounter): "
              f"step(s) {', '.join(guessed)} - confirm the type against the source")
    if warns:
        print(f"  [WARN] {sec['id']}: scaffold has fragments; compare with the canonical text and fix via "
              f"scripts/patch_section.py (arrays replace) before QA.")


def run_validate(sec: Dict[str, Any]) -> bool:
    """Validates structured guide JSON against the JSON Schema definition."""
    _, structured_path = get_section_paths(sec)
    print(f"\n--- Schema Validation: {sec['id']} ---")
    
    if not structured_path.exists():
        print(f"[FAIL] Structured file does not exist: {structured_path}")
        return False

    schema_path = ROOT_DIR / ".claude" / "skills" / "guide-transformer" / "schemas" / "structured-guide.schema.json"
    if not schema_path.exists():
        print(f"[FAIL] Schema not found at {schema_path}")
        return False

    schema = load_schema(str(schema_path))
    validator = Draft202012Validator(schema)
    errors = validate_file(str(structured_path), validator)

    if not errors:
        print(f"[PASS] Schema validation passed: {structured_path.name}")
        return True
    else:
        print(f"[FAIL] Schema validation failed with {len(errors)} error(s):")
        for err in errors[:10]:
            print(f"  - {err}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more.")
        return False


def _short(text: Any, limit: int = 90) -> str:
    s = " ".join(str(text).split())
    return s if len(s) <= limit else s[: limit - 3] + "..."


def save_qa_report(section_id: str, report: Dict[str, Any]) -> Path:
    """Writes the full QA report to qa-reports/<id>.md (+ .json) and returns the markdown path."""
    out_dir = ROOT_DIR / "qa-reports"
    out_dir.mkdir(exist_ok=True)
    md_path = out_dir / f"{section_id}.md"
    md_path.write_text(format_markdown_report(report) + "\n", encoding="utf-8")
    (out_dir / f"{section_id}.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return md_path


def run_qa(sec: Dict[str, Any]) -> bool:
    """Runs QA verification and records the result in qa-status.json."""
    canonical_path, structured_path = get_section_paths(sec)
    print(f"\n--- QA Verification: {sec['id']} ---")

    if not canonical_path.exists():
        print(f"[FAIL] Canonical file does not exist: {canonical_path}")
        return False
    if not structured_path.exists():
        print(f"[FAIL] Structured file does not exist: {structured_path}")
        return False

    with open(canonical_path, "r", encoding="utf-8") as f:
        canonical = json.load(f)
    with open(structured_path, "r", encoding="utf-8") as f:
        structured = json.load(f)

    report = verify_guide(canonical, structured)
    qa_meta = report.get("qa", {})
    status = qa_meta.get("status", "FAIL")
    summary = qa_meta.get("summary", {})

    print(f"QA Status: [{status}]")
    print(f"  Critical: {summary.get('critical', 0)} | High: {summary.get('high', 0)} | "
          f"Medium: {summary.get('medium', 0)} | Low: {summary.get('low', 0)}")

    findings = qa_meta.get("findings", [])
    for f in findings:
        print(f"  {f.get('id')} [{f.get('severity', '').upper()}] {f.get('location')}")
        print(f"      {f.get('category')}: {f.get('description')}")
        print(f"      source: {_short(f.get('source', {}).get('text'))} | generated: {_short(f.get('generated', {}).get('text'))}")

    report_path = save_qa_report(sec["id"], report)
    print(f"  Full report: {report_path.relative_to(ROOT_DIR)}")

    status_module.record_qa_result(ROOT_DIR, sec["id"], structured_path, status, summary)

    return status.startswith("PASS")


def run_build() -> bool:
    """Runs the Astro build so rendering/type errors surface per section."""
    import subprocess
    print("\n--- Frontend Build ---")
    npm = ["cmd", "/c", "npm", "run", "build"] if os.name == "nt" else ["npm", "run", "build"]
    result = subprocess.run(npm, cwd=ROOT_DIR, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        print("[FAIL] npm run build failed:")
        print("\n".join((result.stdout + result.stderr).strip().splitlines()[-25:]))
        return False
    print("[PASS] npm run build succeeded.")
    return True


def run_frontend_audit() -> bool:
    """Audits Astro template source files and compiled HTML for mobile/UX issues."""
    print("\n--- Frontend & UX Audit ---")
    src_issues, src_warnings = audit_astro_sources()
    html_issues, html_warnings = audit_built_html()

    total_issues = len(src_issues) + len(html_issues)
    total_warnings = len(src_warnings) + len(html_warnings)

    if total_issues > 0:
        print("[FAIL] Critical frontend issues detected:")
        for item in src_issues + html_issues:
            print(f"  - {item}")
        return False
    else:
        if total_warnings > 0:
            print(f"[PASS] 0 critical issues. {total_warnings} recommendation(s):")
            for item in (src_warnings + html_warnings)[:5]:
                print(f"  - {item}")
        else:
            print("[PASS] All Frontend & UX checks passed cleanly.")
        return True


def run_lint(sec: Dict[str, Any]) -> bool:
    """Presentation lint of a structured guide. Warnings fail the run; `info` findings do not."""
    _, structured_path = get_section_paths(sec)
    if not structured_path.exists():
        print(f"[SKIP] {sec['id']}: not structured")
        return True
    with open(structured_path, "r", encoding="utf-8") as f:
        guide = json.load(f).get("guide", {})
    findings = lint_guide(guide)
    warns = [f for f in findings if f["severity"] == "warn"]
    print(f"\n--- Lint: {sec['id']} --- {len(warns)} warning(s), {len(findings) - len(warns)} info")
    for f in findings:
        tag = "WARN" if f["severity"] == "warn" else "INFO"
        print(f"  [{tag}] {f['check']:<14} {f['location']}: {f['text']}")
    return not warns


def structured_sha256(path: Path) -> str:
    import hashlib
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stale_verdict_note(sec: Dict[str, Any]) -> Optional[str]:
    """Returns a warning when the stored subagent verdict no longer matches the structured file."""
    verdict_path = ROOT_DIR / "qa-reports" / f"{sec['id']}.subagent.json"
    _, structured_path = get_section_paths(sec)
    if not verdict_path.exists() or not structured_path.exists():
        return None
    try:
        recorded = json.loads(verdict_path.read_text(encoding="utf-8")).get("structured_sha256")
    except ValueError:
        return None
    if not recorded:
        return (f"[NOTE] {sec['id']}: stored subagent verdict has no content hash (recorded before hashing); "
                f"re-record with --verdict to enable the stale check.")
    if recorded != structured_sha256(structured_path):
        return (f"[WARN] {sec['id']}: structured file changed after the subagent verdict; "
                f"re-run the independent QA subagent and record it with --verdict.")
    return None


def run_verdict(sec: Dict[str, Any], verdict_file: str) -> bool:
    """Validates the independent QA subagent's JSON verdict and stores it next to the QA report."""
    print(f"\n--- Subagent QA Verdict: {sec['id']} ---")
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig") if verdict_file == "-" else Path(verdict_file).read_text(encoding="utf-8")
        verdict = json.loads(raw)
    except (OSError, ValueError) as err:
        print(f"[FAIL] Cannot read verdict JSON '{verdict_file}': {err}")
        return False
    schema_path = ROOT_DIR / ".claude" / "skills" / "qa" / "schemas" / "qa-verdict.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(verdict), key=lambda e: list(e.path))
    if errors:
        print(f"[FAIL] Verdict does not match qa-verdict.schema.json ({len(errors)} error(s)):")
        for e in errors[:10]:
            print(f"  - {'/'.join(map(str, e.path)) or '<root>'}: {e.message}")
        return False
    if verdict["section_id"] != sec["id"]:
        print(f"[FAIL] Verdict is for '{verdict['section_id']}', not '{sec['id']}'")
        return False
    out = ROOT_DIR / "qa-reports"
    out.mkdir(exist_ok=True)
    _, structured_path = get_section_paths(sec)
    if structured_path.exists():
        verdict["structured_sha256"] = structured_sha256(structured_path)  # stale check in --finalize/--check
    (out / f"{sec['id']}.subagent.json").write_text(
        json.dumps(verdict, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    findings = verdict["findings"]
    print(f"Verdict: [{verdict['verdict']}] with {len(findings)} finding(s)")
    for f in findings:
        print(f"  [{f['severity'].upper()}] {f['category']} @ {f['location']}: {f['issue']}")
    print(f"  Stored: qa-reports/{sec['id']}.subagent.json")
    draft = out / f"{sec['id']}.subagent-draft.json"
    if draft.exists():
        draft.unlink()  # the stored verdict supersedes the subagent's scratch file
    return verdict["verdict"] != "FAIL"


def remind_independent_qa(sec: Dict[str, Any]) -> None:
    """Walkthroughs need an independent QA subagent pass (manual step, see CLAUDE.md section 5)."""
    if not str(sec.get("id", "")).startswith("w-"):
        return
    if (ROOT_DIR / "qa-reports" / f"{sec['id']}.subagent.json").exists():
        note = stale_verdict_note(sec)
        if note:
            print(f"\n{note}")
        return  # verdict already stored via --verdict
    print(f"\n[REMINDER] Independent QA subagent not run by the pipeline. For {sec['id']}, run "
          f"pipeline.py {sec['id']} --qa-subagent-prompt, give that prompt to a subagent, then store its "
          f"verdict with: pipeline.py {sec['id']} --verdict <file.json>")


def print_subagent_prompt(sec: Dict[str, Any]) -> bool:
    """Prints the exact prompt for the independent QA subagent and the path it should write to."""
    canonical_path, structured_path = get_section_paths(sec)
    if not structured_path.exists():
        print(f"[FAIL] Structured file does not exist: {structured_path}")
        return False
    verdict_path = ROOT_DIR / "qa-reports" / f"{sec['id']}.subagent-draft.json"
    schema = (ROOT_DIR / ".claude" / "skills" / "qa" / "schemas" / "qa-verdict.schema.json").relative_to(ROOT_DIR)
    rel = lambda p: p.relative_to(ROOT_DIR).as_posix()
    print(f"""Use the `qa` skill. Independently review section {sec['id']} ({sec.get('title')}).

Compare the canonical source with the structured guide and judge whether the presentation changed
while the source meaning stayed intact (names, numbers, conditions, warnings, choices, bosses,
items, save points, ordering). Do not edit any file except the verdict.

  canonical:  {rel(canonical_path)}
  structured: {rel(structured_path)}
  script QA:  qa-reports/{sec['id']}.md (for context only; do not trust it)

Return ONLY a JSON verdict that validates against {schema.as_posix()} and write it to
{rel(verdict_path)}.

Do NOT run `pipeline.py --verdict` yourself: the caller records the verdict after reading it.
(The caller stores it with: .\\scripts\\run-py.cmd scripts/pipeline.py {sec['id']} --verdict {rel(verdict_path)})""")
    return True


def run_finalize(sec: Dict[str, Any]) -> bool:
    """Stages exactly this section's files for one commit (never commits)."""
    import subprocess
    _, structured_path = get_section_paths(sec)
    sid = sec["id"]
    candidates = [structured_path, ROOT_DIR / "qa-status.json", ROOT_DIR / "STATUS.md",
                  ROOT_DIR / "qa-reports" / f"{sid}.md", ROOT_DIR / "qa-reports" / f"{sid}.json",
                  ROOT_DIR / "qa-reports" / f"{sid}.subagent.json"]
    print(f"\n--- Finalize: {sid} ---")
    if not structured_path.exists():
        print(f"[FAIL] Structured file does not exist: {structured_path}")
        return False
    if sid.startswith("w-") and not candidates[-1].exists():
        print(f"[FAIL] Independent QA verdict missing (qa-reports/{sid}.subagent.json); run --verdict first.")
        return False
    qa = status_module.audit_section(ROOT_DIR, sec, status_module.load_qa_status(ROOT_DIR))["qa_status"]
    if not str(qa).startswith("PASS"):
        print(f"[FAIL] Script QA is {qa}; run --check until it passes.")
        return False
    note = stale_verdict_note(sec)
    if note:
        print(note)
    paths = [str(p.relative_to(ROOT_DIR)) for p in candidates if p.exists()]
    result = subprocess.run(["git", "add", "--", *paths], cwd=ROOT_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FAIL] git add failed: {result.stderr.strip()}")
        return False
    print("Staged:")
    for path in paths:
        print(f"  {path}")
    print(f"Suggested message: feat(guide): add {sid} {sec.get('title')} structured section with QA verdict")
    return True


def update_project_status():
    print("\n--- Updating Project Status ---")
    root = status_module.get_project_root()
    data = status_module.compute_project_status(root)
    status_module.write_status_markdown(root, data)
    print(status_module.render_compact_summary(data))


def print_section_status(sec: Dict[str, Any]):
    canonical_path, structured_path = get_section_paths(sec)
    print(f"\nSection Status: {sec['id']} - {sec.get('title')}")
    print(f"  Code:       {sec.get('code')}")
    print(f"  Category:   {sec.get('category')}")
    print(f"  Canonical:  {'EXISTS' if canonical_path.exists() else 'MISSING'} ({canonical_path.name})")
    print(f"  Structured: {'EXISTS' if structured_path.exists() else 'MISSING'} ({structured_path.name})")
    audited = status_module.audit_section(ROOT_DIR, sec, status_module.load_qa_status(ROOT_DIR))
    qa = audited["qa_status"]
    print(f"  QA:         {'PENDING (none or stale)' if qa == 'NONE' else qa}")


def resolve_backlog() -> int:
    """Runs QA on every structured section with no current QA result."""
    print("\n=== Resolving QA Backlog ===")
    _, sections = get_canonical_manifest()
    verified_count = 0

    for sec in sections:
        audited = status_module.audit_section(ROOT_DIR, sec, status_module.load_qa_status(ROOT_DIR))

        if audited["structured"] and audited["qa_status"] == "NONE":
            print(f"\nProcessing backlog for section: {sec['id']} ({sec.get('title')})")
            val_ok = run_validate(sec)
            if not val_ok:
                print(f"[WARN] Validation issues in {sec['id']}, proceeding to QA...")
            qa_ok = run_qa(sec)
            if qa_ok:
                print(f"[PASS] Successfully verified {sec['id']}.")
                verified_count += 1
            else:
                print(f"[WARN] QA reported issues for {sec['id']}.")

    if verified_count > 0:
        update_project_status()
        print(f"\nResolved backlog for {verified_count} section(s).")
    else:
        print("No pending QA backlog items found.")

    return verified_count


def _execute_section_actions(sec: Dict[str, Any], args: argparse.Namespace) -> bool:
    """Executes requested operations against a specific section."""
    success = True

    if args.scaffold:
        success = run_scaffold(sec, force=args.force) and success

    if args.validate:
        success = run_validate(sec) and success

    if args.qa:
        success = run_qa(sec) and success

    if args.verify:
        v_ok = run_validate(sec)
        q_ok = run_qa(sec)
        b_ok = run_build()
        success = v_ok and q_ok and b_ok
        if success:
            update_project_status()
            remind_independent_qa(sec)

    if args.lint:
        success = run_lint(sec) and success

    if args.verdict:
        success = run_verdict(sec, args.verdict) and success

    if args.qa_subagent_prompt:
        success = print_subagent_prompt(sec) and success

    if args.frontend:
        f_ok = run_frontend_audit()
        success = f_ok and success

    if args.finalize:
        success = run_finalize(sec) and success

    if args.check or args.full:
        v_ok = run_validate(sec)
        q_ok = run_qa(sec)
        b_ok = run_build()
        success = v_ok and q_ok and b_ok
        if success:
            update_project_status()
            remind_independent_qa(sec)
        if args.full:
            f_ok = run_frontend_audit()
            success = success and f_ok

    return success


def main():
    """CLI orchestrator handling pipeline operations."""
    parser = argparse.ArgumentParser(description="Unified Guide Conversion Pipeline CLI")
    parser.add_argument("section", nargs="?", default=None, help="Section ID or file stem (e.g., w-1-04, w-1-04-fengtian)")
    parser.add_argument("--scaffold", action="store_true", help="Scaffold structured guide JSON from canonical")
    parser.add_argument("--validate", action="store_true", help="Validate structured guide against schema")
    parser.add_argument("--qa", action="store_true", help="Run QA verification and record result in qa-status.json")
    parser.add_argument("--verify", action="store_true", help="Validate + QA + Build + Update status")
    parser.add_argument("--frontend", action="store_true", help="Run frontend audit")
    parser.add_argument("--check", action="store_true", help="Lean per-section check: Validate + QA + Build + Update status")
    parser.add_argument("--full", action="store_true", help="--check plus Frontend audit")
    parser.add_argument("--lint", action="store_true", help="Presentation lint (all structured guides when no section is given)")
    parser.add_argument("--verdict", metavar="FILE", help="Validate and store the independent QA subagent's JSON verdict ('-' reads stdin)")
    parser.add_argument("--qa-subagent-prompt", action="store_true", help="Print the prompt for the independent QA subagent and its verdict path")
    parser.add_argument("--finalize", action="store_true", help="Stage exactly this section's files (section JSON, QA reports, status files); does not commit")
    parser.add_argument("--backlog", action="store_true", help="Run QA on all structured files lacking a current QA result")
    parser.add_argument("--force", "-f", action="store_true", help="Force overwrite when scaffolding")

    args = parser.parse_args()

    if args.backlog:
        resolve_backlog()
        return

    if not args.section:
        if args.lint:
            _, sections = get_canonical_manifest()
            ok = all([run_lint(sec) for sec in sections])
            sys.exit(0 if ok else 1)
        if args.frontend:
            run_frontend_audit()
            return
        parser.print_help()
        sys.exit(1)

    sec = resolve_section(args.section)
    if not sec:
        print(f"[ERROR] Could not resolve section for identifier: '{args.section}'")
        sys.exit(1)

    if not any([args.scaffold, args.validate, args.qa, args.verify, args.frontend, args.check, args.full,
                args.lint, args.verdict, args.qa_subagent_prompt, args.finalize]):
        print_section_status(sec)
        return

    if not _execute_section_actions(sec, args):
        sys.exit(1)


if __name__ == "__main__":
    main()
