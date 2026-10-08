#!/usr/bin/env python3
"""
status.py - Project status summary and QA-result store.

Usage:
    python scripts/status.py             # Print compact summary
    python scripts/status.py --summary   # Same (kept for CLAUDE.md compatibility)
    python scripts/status.py --update    # Regenerate root STATUS.md
    python scripts/status.py --json      # Raw JSON
"""

import sys
import json
import hashlib
import argparse
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

QA_STATUS_FILE = "qa-status.json"


def get_project_root() -> Path:
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "canonical-sources").exists() or (p / ".claude").exists():
            return p
    return Path.cwd()


def load_canonical_index(root: Path) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    path = root / "canonical-sources" / "shadow-hearts-guide.canonical.json"
    if not path.exists():
        raise FileNotFoundError(f"Canonical manifest not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("source", {}), data.get("sections_index", [])


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def load_qa_status(root: Path) -> Dict[str, Any]:
    path = root / QA_STATUS_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def record_qa_result(root: Path, sec_id: str, structured_path: Path, status: str, summary: Dict[str, Any]) -> None:
    """Persist a section's QA result, tied to the structured file's content hash."""
    data = load_qa_status(root)
    data[sec_id] = {
        "status": status,
        "summary": summary,
        "content_hash": file_hash(structured_path),
        "checked_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    (root / QA_STATUS_FILE).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def audit_section(root: Path, sec: Dict[str, Any], qa_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    sec_id = sec.get("id", "")
    rel_file = sec.get("file", "")
    filename = Path(rel_file).name if rel_file else f"{sec_id}.json"
    structured_path = root / "structured-content" / "sections" / filename

    canonical_ok = (root / "canonical-sources" / rel_file).exists()
    structured_ok = structured_path.exists()
    web_built = any(p.exists() for p in (
        root / "dist" / f"{sec_id}.html",
        root / "dist" / "guide" / f"{sec_id}.html",
        root / "dist" / "guide" / sec_id / "index.html",
    ))

    # A stored QA result only counts while the structured file is unchanged since QA ran.
    qa_status = "NONE"
    entry = (qa_data or {}).get(sec_id)
    if entry and structured_ok and entry.get("content_hash") == file_hash(structured_path):
        qa_status = "PASS" if str(entry.get("status", "")).startswith("PASS") else "FAIL"

    if not canonical_ok:
        state = "MISSING_CANONICAL"
    elif not structured_ok:
        state = "NOT_STRUCTURED"
    elif qa_status == "NONE":
        state = "STRUCTURED_PENDING_QA"
    elif qa_status == "FAIL":
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
        "canonical": canonical_ok,
        "structured": structured_ok,
        "qa_status": qa_status,
        "web_built": web_built,
        "state": state,
    }


def compute_project_status(root: Path) -> Dict[str, Any]:
    _, sections_index = load_canonical_index(root)
    qa_data = load_qa_status(root)
    sections = [audit_section(root, s, qa_data) for s in sections_index]
    total = len(sections)

    def ref(s):
        return {"id": s["id"], "title": s["title"], "code": s["code"]}

    metrics = {
        "total": total,
        "canonical": sum(s["canonical"] for s in sections),
        "structured": sum(s["structured"] for s in sections),
        "qa_pass": sum(s["qa_status"] == "PASS" for s in sections),
        "qa_fail": sum(s["qa_status"] == "FAIL" for s in sections),
        "web": sum(s["web_built"] for s in sections),
    }

    walk = [s for s in sections if s["category"].startswith("Walkthrough")]
    last_structured = max((i for i, s in enumerate(walk) if s["structured"]), default=-1)
    gaps = [ref(s) for s in walk[:last_structured] if not s["structured"]]
    failing = [ref(s) for s in sections if s["qa_status"] == "FAIL"]
    pending_qa = [ref(s) for s in sections if s["structured"] and s["qa_status"] == "NONE"]
    next_section = next((ref(s) for s in walk if not s["structured"]), None)

    # Priority order from CLAUDE.md: sequence gaps -> QA FAILs -> pending QA -> next section.
    priorities = []
    if gaps:
        priorities.append(f"Structure {gaps[0]['id']} ({gaps[0]['title']}) - sequence gap")
    if failing:
        priorities.append(f"Fix QA FAIL in {failing[0]['id']} ({failing[0]['title']})")
    if pending_qa:
        priorities.append(f"Run QA on {pending_qa[0]['id']} ({pending_qa[0]['title']})")
    if next_section and not gaps:
        priorities.append(f"Structure {next_section['id']} ({next_section['title']}) - next chronological")

    return {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": metrics,
        "priorities": priorities,
        "sequence_gaps": gaps,
        "qa_failures": failing,
        "pending_qa": pending_qa,
        "sections": sections,
    }


def render_compact_summary(data: Dict[str, Any]) -> str:
    m = data["metrics"]
    t = m["total"]
    lines = [
        f"=== PROJECT STATUS ({data['timestamp']}) ===",
        f"Canonical {m['canonical']}/{t} | Structured {m['structured']}/{t} | "
        f"QA pass {m['qa_pass']}/{t} (fail {m['qa_fail']}) | Web built {m['web']}/{t}",
        "Next:",
    ]
    lines += [f"  {i}. {p}" for i, p in enumerate(data["priorities"], 1)] or ["  (nothing pending)"]
    if data["sequence_gaps"]:
        lines.append("Sequence gaps: " + ", ".join(g["id"] for g in data["sequence_gaps"]))
    if data["qa_failures"]:
        lines.append("QA FAIL:       " + ", ".join(f["id"] for f in data["qa_failures"]))
    if data["pending_qa"]:
        lines.append("Pending QA:    " + ", ".join(p["id"] for p in data["pending_qa"]))
    return "\n".join(lines)


def generate_status_markdown(data: Dict[str, Any]) -> str:
    """STATUS.md: summary block first (<45 lines), then the full section matrix."""
    lines = [
        "# Shadow Hearts Guide Converter - Project Status",
        "",
        f"> Last synced: `{data['timestamp']}`",
        "",
        "```text",
        render_compact_summary(data),
        "```",
        "",
        "## Section Matrix",
        "",
        "| Code | ID | Title | Category | State |",
        "| :-- | :-- | :-- | :-- | :-- |",
    ]
    for s in data["sections"]:
        lines.append(f"| `{s['code']}` | `{s['id']}` | {s['title']} | {s['category']} | {s['state']} |")
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Project status summary.")
    parser.add_argument("--update", "-u", action="store_true", help="Regenerate root STATUS.md")
    parser.add_argument("--summary", "-s", action="store_true", help="Print compact summary (default)")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    root = get_project_root()
    data = compute_project_status(root)

    if args.json:
        print(json.dumps(data, indent=2))
        return
    if args.update:
        (root / "STATUS.md").write_text(generate_status_markdown(data), encoding="utf-8")
        print(f"Updated {root / 'STATUS.md'}")
    print(render_compact_summary(data))


if __name__ == "__main__":
    main()
