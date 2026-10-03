#!/usr/bin/env python3
"""
status.py - Project Status Tracker & Agent Context Generator

Scans canonical sources, structured content, QA reports, and web builder artifacts
to compute live project progress metrics, identify sequence gaps, and determine
immediate next actions.

Usage:
    python scripts/status.py             # Display formatted terminal dashboard
    python scripts/status.py --summary   # Ultra-compact text block (token-efficient)
    python scripts/status.py --update    # Re-generate root STATUS.md
    python scripts/status.py --json      # Output raw JSON to stdout
"""

import sys
import json
import argparse
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple


def get_project_root() -> Path:
    """Locate project root (contains canonical-sources or .agents)."""
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "canonical-sources").exists() or (p / ".agents").exists():
            return p
    return Path.cwd()


def load_canonical_index(root: Path) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Load canonical manifest and sections_index."""
    manifest_path = root / "canonical-sources" / "shadow-hearts-guide.canonical.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Canonical manifest not found: {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    source_info = data.get("source", {})
    sections_index = data.get("sections_index", [])
    return source_info, sections_index


def audit_section(root: Path, sec: Dict[str, Any]) -> Dict[str, Any]:
    """Audit status of a single section across the entire pipeline."""
    sec_id = sec.get("id", "")
    rel_canonical_file = sec.get("file", "")
    filename = Path(rel_canonical_file).name if rel_canonical_file else f"{sec_id}.json"

    canonical_path = root / "canonical-sources" / rel_canonical_file
    structured_path = root / "structured-content" / "sections" / filename
    
    # QA report can be {id}-qa-report.md or {stem}-qa-report.md
    stem = Path(filename).stem
    qa_path1 = root / "qa-reports" / f"{sec_id}-qa-report.md"
    qa_path2 = root / "qa-reports" / f"{stem}-qa-report.md"
    
    qa_path = qa_path1 if qa_path1.exists() else (qa_path2 if qa_path2.exists() else None)

    # Web output check (dist/guide/{id}/index.html, dist/{id}.html, etc.)
    web_candidates = [
        root / "dist" / f"{sec_id}.html",
        root / "dist" / "guide" / sec_id / "index.html",
        root / "site" / "dist" / f"{sec_id}.html",
    ]
    web_built = any(p.exists() for p in web_candidates)

    canonical_ok = canonical_path.exists()
    structured_ok = structured_path.exists()
    qa_status = "NONE"

    if qa_path and qa_path.exists():
        try:
            content = qa_path.read_text(encoding="utf-8")
            if "[PASS]" in content or "Status: PASS" in content:
                qa_status = "PASS"
            elif "[FAIL]" in content or "Status: FAIL" in content:
                qa_status = "FAIL"
            else:
                qa_status = "REPORTED"
        except Exception:
            qa_status = "READ_ERR"

    # Determine overall lifecycle state
    if not canonical_ok:
        state = "MISSING_CANONICAL"
    elif not structured_ok:
        state = "NOT_STRUCTURED"
    elif qa_status == "NONE":
        state = "STRUCTURED_PENDING_QA"
    elif qa_status in ("FAIL", "REPORTED"):
        state = "QA_ISSUES"
    elif not web_built:
        state = "QA_PASSED"
    else:
        state = "WEB_BUILT"

    return {
        "id": sec_id,
        "code": sec.get("code", ""),
        "title": sec.get("title", ""),
        "category": sec.get("category", "Other"),
        "is_sidequest": sec.get("is_sidequest", False),
        "filename": filename,
        "canonical": canonical_ok,
        "structured": structured_ok,
        "qa_status": qa_status,
        "qa_report_file": qa_path.name if qa_path else None,
        "web_built": web_built,
        "state": state
    }


def compute_project_status(root: Path) -> Dict[str, Any]:
    """Compute complete project status, metrics, sequence gaps, and priorities."""
    source_info, sections_index = load_canonical_index(root)
    
    sections = [audit_section(root, s) for s in sections_index]
    total_sections = len(sections)

    canonical_count = sum(1 for s in sections if s["canonical"])
    structured_count = sum(1 for s in sections if s["structured"])
    qa_pass_count = sum(1 for s in sections if s["qa_status"] == "PASS")
    qa_any_count = sum(1 for s in sections if s["qa_status"] != "NONE")
    web_count = sum(1 for s in sections if s["web_built"])

    # Categorized breakdown
    categories: Dict[str, Dict[str, Any]] = {}
    for s in sections:
        cat = s["category"]
        if cat not in categories:
            categories[cat] = {
                "name": cat,
                "total": 0,
                "canonical": 0,
                "structured": 0,
                "qa_passed": 0,
                "web_built": 0,
                "sections": []
            }
        categories[cat]["total"] += 1
        if s["canonical"]:
            categories[cat]["canonical"] += 1
        if s["structured"]:
            categories[cat]["structured"] += 1
        if s["qa_status"] == "PASS":
            categories[cat]["qa_passed"] += 1
        if s["web_built"]:
            categories[cat]["web_built"] += 1
        categories[cat]["sections"].append(s)

    # Detect sequence gaps in walkthrough
    walkthrough_sections = [s for s in sections if s["category"].startswith("Walkthrough")]
    sequence_gaps = []
    last_structured_idx = -1
    for i, s in enumerate(walkthrough_sections):
        if s["structured"]:
            # Check if any prior section was skipped
            for prev_idx in range(last_structured_idx + 1, i):
                skipped = walkthrough_sections[prev_idx]
                if not skipped["structured"]:
                    sequence_gaps.append({
                        "id": skipped["id"],
                        "title": skipped["title"],
                        "code": skipped["code"],
                        "reason": f"Skipped before {s['id']}"
                    })
            last_structured_idx = i

    # Identify pending QA
    pending_qa = [
        {"id": s["id"], "title": s["title"], "code": s["code"]}
        for s in sections
        if s["structured"] and s["qa_status"] == "NONE"
    ]

    # Find the next section to structure (chronological walkthrough first, or gap)
    next_to_structure = None
    if sequence_gaps:
        next_to_structure = sequence_gaps[0]
    else:
        for s in walkthrough_sections:
            if not s["structured"]:
                next_to_structure = {"id": s["id"], "title": s["title"], "code": s["code"]}
                break

    # Determine ranked priority queue
    next_priorities = []
    if sequence_gaps:
        gap = sequence_gaps[0]
        next_priorities.append({
            "priority": "HIGH",
            "action": f"Structure {gap['id']} ({gap['title']})",
            "reason": f"Sequence gap: was skipped while later section is already structured."
        })
    if pending_qa:
        pqa = pending_qa[0]
        next_priorities.append({
            "priority": "MEDIUM",
            "action": f"Run QA on {pqa['id']} ({pqa['title']})",
            "reason": "Structured JSON exists but QA verification report is missing."
        })
    if next_to_structure and (not sequence_gaps or next_to_structure["id"] != sequence_gaps[0]["id"]):
        next_priorities.append({
            "priority": "MEDIUM",
            "action": f"Structure {next_to_structure['id']} ({next_to_structure['title']})",
            "reason": "Next chronological section in the walkthrough sequence."
        })
    
    # Web Builder status check
    astro_initialized = (root / "astro.config.mjs").exists() or (root / "package.json").exists()
    if not astro_initialized:
        next_priorities.append({
            "priority": "LOW",
            "action": "Initialize Web Builder Astro site",
            "reason": "Static site generator skeleton has not been initialized yet."
        })

    # Overall percentage
    canonical_pct = (canonical_count / total_sections * 100) if total_sections else 0
    structured_pct = (structured_count / total_sections * 100) if total_sections else 0
    qa_pct = (qa_pass_count / total_sections * 100) if total_sections else 0
    web_pct = (web_count / total_sections * 100) if total_sections else 0

    return {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": source_info,
        "metrics": {
            "total_sections": total_sections,
            "canonical_count": canonical_count,
            "canonical_pct": round(canonical_pct, 1),
            "structured_count": structured_count,
            "structured_pct": round(structured_pct, 1),
            "qa_pass_count": qa_pass_count,
            "qa_any_count": qa_any_count,
            "qa_pct": round(qa_pct, 1),
            "web_count": web_count,
            "web_pct": round(web_pct, 1),
        },
        "infrastructure": {
            "source_importer": "READY (69 canonical sections imported)",
            "guide_transformer": "READY (schema, validator & scaffold available)",
            "qa_framework": "READY (verify_guide.py operational)",
            "web_builder": "PENDING (Astro site not yet initialized)",
            "github_pages": "PENDING (Workflow not configured)"
        },
        "active_milestone": "Milestone 2: Asia Walkthrough Content Transformation",
        "next_priorities": next_priorities,
        "sequence_gaps": sequence_gaps,
        "pending_qa": pending_qa,
        "categories": categories,
        "sections": sections
    }


def make_progress_bar(pct: float, width: int = 24) -> str:
    filled = int(round(width * (pct / 100.0)))
    empty = width - filled
    return f"[{'#' * filled}{'-' * empty}] {pct:.1f}%"


def generate_status_markdown(data: Dict[str, Any]) -> str:
    """Generate STATUS.md content with token-lean top block (<45 lines)."""
    m = data["metrics"]
    infra = data["infrastructure"]
    priors = data["next_priorities"]
    gaps = data["sequence_gaps"]
    pending_qa = data["pending_qa"]

    lines = []
    lines.append("# Shadow Hearts Guide Converter — Project Status")
    lines.append("")
    lines.append(f"> **Last Synced:** `{data['timestamp']}` | **Active Milestone:** {data['active_milestone']}")
    lines.append("")
    lines.append("## 1. Quick Orientation (Agent Context)")
    lines.append("")
    lines.append("```text")
    lines.append(f"Canonical Import:   {make_progress_bar(m['canonical_pct'])} ({m['canonical_count']}/{m['total_sections']})")
    lines.append(f"Structured Content: {make_progress_bar(m['structured_pct'])} ({m['structured_count']}/{m['total_sections']})")
    lines.append(f"QA Verified:        {make_progress_bar(m['qa_pct'])} ({m['qa_pass_count']}/{m['total_sections']})")
    lines.append(f"Web Pages Built:    {make_progress_bar(m['web_pct'])} ({m['web_count']}/{m['total_sections']})")
    lines.append("```")
    lines.append("")
    lines.append("### Next Priority Actions (Immediate Queue)")
    for i, p in enumerate(priors, 1):
        lines.append(f"{i}. **[{p['priority']}]** `{p['action']}` — *{p['reason']}*")
    lines.append("")

    if gaps or pending_qa:
        lines.append("### Pipeline Notices & Gaps")
        for g in gaps:
            lines.append(f"- :warning: **Sequence Gap:** `{g['id']}` ({g['title']}) was skipped. Expected next in sequence.")
        for pq in pending_qa:
            lines.append(f"- :mag: **Pending QA:** `{pq['id']}` ({pq['title']}) is structured but lacks a QA report.")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 2. Infrastructure & Skills Readiness")
    lines.append("")
    lines.append("| Component | Status | Details |")
    lines.append("| :--- | :---: | :--- |")
    lines.append(f"| **Source Importer** | :white_check_mark: | {infra['source_importer']} |")
    lines.append(f"| **Guide Transformer** | :white_check_mark: | {infra['guide_transformer']} |")
    lines.append(f"| **QA Verifier** | :white_check_mark: | {infra['qa_framework']} |")
    lines.append(f"| **Web Builder** | :hourglass_flowing_sand: | {infra['web_builder']} |")
    lines.append(f"| **GitHub Pages** | :hourglass_flowing_sand: | {infra['github_pages']} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 3. Category Progress Overview")
    lines.append("")
    lines.append("| Category | Total | Canonical | Structured | QA Passed | Web Built | Progress |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :--- |")
    for cat_name, c in data["categories"].items():
        pct = (c["qa_passed"] / c["total"] * 100) if c["total"] else 0
        bar = make_progress_bar(pct, width=12)
        lines.append(f"| **{cat_name}** | {c['total']} | {c['canonical']} | {c['structured']} | {c['qa_passed']} | {c['web_built']} | `{bar}` |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 4. Complete Section Matrix")
    lines.append("")

    badge_map = {
        "MISSING_CANONICAL": ":x: Missing Canonical",
        "NOT_STRUCTURED": ":white_circle: To Do",
        "STRUCTURED_PENDING_QA": ":eyes: Pending QA",
        "QA_ISSUES": ":warning: QA Issues",
        "QA_PASSED": ":white_check_mark: QA Pass",
        "WEB_BUILT": ":rocket: Web Built"
    }

    for cat_name, c in data["categories"].items():
        lines.append(f"### {cat_name} ({len(c['sections'])} sections)")
        lines.append("")
        lines.append("| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |")
        lines.append("| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |")
        for s in c["sections"]:
            canon_icon = ":white_check_mark:" if s["canonical"] else ":x:"
            struct_icon = ":white_check_mark:" if s["structured"] else ":white_circle:"
            qa_icon = ":white_check_mark:" if s["qa_status"] == "PASS" else (":warning:" if s["qa_status"] == "FAIL" else (":eyes:" if s["qa_status"] != "NONE" else ":white_circle:"))
            web_icon = ":white_check_mark:" if s["web_built"] else ":white_circle:"

            # Recommendation
            if not s["structured"]:
                action = f"Transform `{s['id']}`"
            elif s["qa_status"] == "NONE":
                action = f"QA Verify `{s['id']}`"
            elif s["qa_status"] != "PASS":
                action = f"Fix QA defects in `{s['id']}`"
            elif not s["web_built"]:
                action = f"Build web page for `{s['id']}`"
            else:
                action = "Completed"

            lines.append(f"| `{s['code']}` | `{s['id']}` | {s['title']} | {canon_icon} | {struct_icon} | {qa_icon} | {web_icon} | {action} |")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 5. Developer & Agent Commands")
    lines.append("")
    lines.append("- **View Compact Status (Terminal):** `python scripts/status.py --summary`")
    lines.append("- **Update Status Dashboard:** `python scripts/status.py --update`")
    lines.append("- **Validate Structured Guide:** `python .agents/skills/guide-transformer/scripts/validate_guide.py <file>`")
    lines.append("- **Run QA Verification:** `python .agents/skills/qa/scripts/verify_guide.py <canonical_file> <structured_file> -r <report_out>`")
    lines.append("")
    return "\n".join(lines)


def render_compact_summary(data: Dict[str, Any]) -> str:
    """Render dense token-efficient summary (<25 lines) for agents or fast terminal display."""
    m = data["metrics"]
    lines = []
    lines.append(f"=== PROJECT STATUS SUMMARY ({data['timestamp']}) ===")
    lines.append(f"Active Milestone: {data['active_milestone']}")
    lines.append(f"Progress: Canonical: {m['canonical_count']}/{m['total_sections']} ({m['canonical_pct']}%) | "
                 f"Structured: {m['structured_count']}/{m['total_sections']} ({m['structured_pct']}%) | "
                 f"QA Passed: {m['qa_pass_count']}/{m['total_sections']} ({m['qa_pct']}%) | "
                 f"Web Built: {m['web_count']}/{m['total_sections']} ({m['web_pct']}%)")
    lines.append("")
    lines.append("Categories (Structured/QA/Total):")
    for cat, c in data["categories"].items():
        lines.append(f"  - {cat:24}: {c['structured']:2d} struct | {c['qa_passed']:2d} QA | {c['total']:2d} total")
    lines.append("")
    lines.append("Next Priority Queue:")
    for i, p in enumerate(data["next_priorities"], 1):
        lines.append(f"  {i}. [{p['priority']}] {p['action']} ({p['reason']})")
    if data["sequence_gaps"]:
        lines.append(f"Sequence Gaps: {', '.join(g['id'] for g in data['sequence_gaps'])}")
    if data["pending_qa"]:
        lines.append(f"Pending QA:    {', '.join(pq['id'] for pq in data['pending_qa'])}")
    lines.append("=====================================================")
    return "\n".join(lines)


def render_terminal_dashboard(data: Dict[str, Any]) -> str:
    """Render visually formatted ASCII dashboard for terminal."""
    m = data["metrics"]
    lines = []
    lines.append("=" * 72)
    lines.append("       SHADOW HEARTS GUIDE CONVERTER -- STATUS DASHBOARD")
    lines.append(f"       Last Synced: {data['timestamp']}")
    lines.append("=" * 72)
    lines.append(f"Milestone: {data['active_milestone']}")
    lines.append("")
    lines.append(f"  1. Canonical Sources:   {make_progress_bar(m['canonical_pct'])}  ({m['canonical_count']}/{m['total_sections']})")
    lines.append(f"  2. Structured Content:  {make_progress_bar(m['structured_pct'])}  ({m['structured_count']}/{m['total_sections']})")
    lines.append(f"  3. QA Verified:         {make_progress_bar(m['qa_pct'])}  ({m['qa_pass_count']}/{m['total_sections']})")
    lines.append(f"  4. Web Pages Built:     {make_progress_bar(m['web_pct'])}  ({m['web_count']}/{m['total_sections']})")
    lines.append("-" * 72)
    lines.append("CATEGORY BREAKDOWN:")
    for cat, c in data["categories"].items():
        pct = (c["qa_passed"] / c["total"] * 100) if c["total"] else 0
        bar = make_progress_bar(pct, width=14)
        lines.append(f"  {cat:24}  struct: {c['structured']:2d}/{c['total']:2d} | QA: {c['qa_passed']:2d}/{c['total']:2d}  {bar}")
    lines.append("-" * 72)
    lines.append("NEXT PRIORITY QUEUE:")
    for i, p in enumerate(data["next_priorities"], 1):
        lines.append(f"  {i}. [{p['priority']:6}] {p['action']}")
        lines.append(f"              -> {p['reason']}")
    if data["sequence_gaps"]:
        lines.append("")
        lines.append("WARNINGS / SEQUENCE GAPS:")
        for g in data["sequence_gaps"]:
            lines.append(f"  ! Gap detected: {g['id']} ({g['title']}) was skipped!")
    if data["pending_qa"]:
        lines.append("")
        lines.append("PENDING QA VERIFICATION:")
        for pq in data["pending_qa"]:
            lines.append(f"  * {pq['id']} ({pq['title']})")
    lines.append("=" * 72)
    lines.append("Tip: run 'python scripts/status.py --update' to sync root STATUS.md")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Track project progress and generate status reports.")
    parser.add_argument("--update", "-u", action="store_true", help="Generate/update root STATUS.md")
    parser.add_argument("--summary", "-s", action="store_true", help="Output compact text summary (token-efficient)")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON status")
    args = parser.parse_args()

    root = get_project_root()
    data = compute_project_status(root)

    if args.json:
        print(json.dumps(data, indent=2))
        return

    if args.summary:
        print(render_compact_summary(data))
        return

    if args.update:
        md_content = generate_status_markdown(data)
        out_path = root / "STATUS.md"
        out_path.write_text(md_content, encoding="utf-8")
        print(f"Successfully generated and updated: {out_path.resolve()}")
        print(render_compact_summary(data))
        return

    # Default: print terminal dashboard
    print(render_terminal_dashboard(data))


if __name__ == "__main__":
    main()
