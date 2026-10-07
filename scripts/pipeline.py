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
    python scripts/pipeline.py --code-review             # Run codebase quality & readability audit
    python scripts/pipeline.py <section_id> --check      # Lean per-section check: validate + QA + build + status
    python scripts/pipeline.py <section_id> --full       # Full check: --check + frontend audit + code review (run every ~5 sections or after UI/code changes)
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
sys.path.insert(0, str(ROOT_DIR / ".claude" / "skills" / "code-reviewer" / "scripts"))
sys.path.insert(0, str(ROOT_DIR / "scripts"))

try:
    from scaffold_structured_guide import scaffold_guide
    from validate_guide import load_schema, validate_file
    from verify_guide import verify_guide
    from audit_frontend import audit_astro_sources, audit_built_html
    from audit_code_quality import run_code_audit
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
        return True
    except Exception as e:
        print(f"[FAIL] Scaffolding failed: {e}")
        return False


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

    findings = report.get("findings", [])
    if findings:
        for f in findings:
            print(f"  - [{f.get('severity', '').upper()}] {f.get('category')}: {f.get('description')}")

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


def run_code_review() -> bool:
    """Runs codebase quality, architecture, and human-readability audit."""
    print("\n--- Code Quality & Readability Review ---")
    critical, warnings = run_code_audit(ROOT_DIR)

    if critical:
        print(f"[FAIL] {len(critical)} critical code quality defect(s):")
        for item in critical:
            print(f"  - CRITICAL: {item}")
        return False

    if warnings:
        print(f"[PASS] 0 critical defects. {len(warnings)} readability recommendation(s):")
        for item in warnings[:5]:
            print(f"  - {item}")
        if len(warnings) > 5:
            print(f"  ... and {len(warnings) - 5} more recommendations.")
    else:
        print("[PASS] Pristine code quality! Zero defects or warnings.")

    return True


def update_project_status():
    print("\n--- Updating Project Status ---")
    root = status_module.get_project_root()
    data = status_module.compute_project_status(root)
    md_content = status_module.generate_status_markdown(data)
    (root / "STATUS.md").write_text(md_content, encoding="utf-8")
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

    if args.frontend:
        f_ok = run_frontend_audit()
        success = f_ok and success

    if args.code_review:
        c_ok = run_code_review()
        success = c_ok and success

    if args.check or args.full:
        v_ok = run_validate(sec)
        q_ok = run_qa(sec)
        b_ok = run_build()
        success = v_ok and q_ok and b_ok
        if success:
            update_project_status()
        if args.full:
            f_ok = run_frontend_audit()
            c_ok = run_code_review()
            success = success and f_ok and c_ok

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
    parser.add_argument("--code-review", "--review", action="store_true", help="Run codebase quality and readability audit")
    parser.add_argument("--check", action="store_true", help="Lean per-section check: Validate + QA + Build + Update status")
    parser.add_argument("--full", action="store_true", help="--check plus Frontend audit and Code review")
    parser.add_argument("--backlog", action="store_true", help="Run QA on all structured files lacking a current QA result")
    parser.add_argument("--force", "-f", action="store_true", help="Force overwrite when scaffolding")

    args = parser.parse_args()

    if args.backlog:
        resolve_backlog()
        return

    if not args.section:
        if args.frontend:
            run_frontend_audit()
            return
        if args.code_review:
            if not run_code_review():
                sys.exit(1)
            return
        parser.print_help()
        sys.exit(1)

    sec = resolve_section(args.section)
    if not sec:
        print(f"[ERROR] Could not resolve section for identifier: '{args.section}'")
        sys.exit(1)

    if not any([args.scaffold, args.validate, args.qa, args.verify, args.frontend, args.code_review, args.check, args.full]):
        print_section_status(sec)
        return

    if not _execute_section_actions(sec, args):
        sys.exit(1)


if __name__ == "__main__":
    main()
