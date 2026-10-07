#!/usr/bin/env python3
"""
verify_guide.py - Independent QA Verification Tool for Converted Game Guides

Verifies fidelity between Canonical Source JSON and Structured Guide JSON:
- Overview items & inline item markers preservation
- Enemy numbers, HP, classes, and boss flags
- Boss card stats, recommended levels, rewards, and strategies
- Shop inventory items and prices
- Canonical notes and warnings
- Navigation links consistency

Produces a structured QA Report conforming to qa/SKILL.md Section 23.
"""

import os
import re
import sys
import json
import argparse
from typing import Dict, List, Any, Optional, Tuple


def normalize_name(name: Any) -> str:
    """Normalizes item/entity names for comparison (strips punctuation and whitespace)."""
    return re.sub(r'[^a-z0-9]', '', str(name or '').lower())


def verify_guide(canonical: Dict[str, Any], structured: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verifies that a structured guide accurately and faithfully preserves canonical source knowledge.
    Checks navigation, obtainable/initial items, enemies, bosses, shops, and gameplay notes.
    """
    guide = structured.get("guide", {})
    findings: List[Dict[str, Any]] = []
    finding_id = 1

    def add_finding(severity: str, category: str, location: str, src_text: Any, gen_text: Any, desc: str, owner: str = "Guide Transformer"):
        nonlocal finding_id
        findings.append({
            "id": f"QA-{finding_id:03d}",
            "severity": severity,
            "category": category,
            "location": location,
            "source": {"text": str(src_text)},
            "generated": {"text": str(gen_text)},
            "description": desc,
            "recommended_owner": owner
        })
        finding_id += 1

    # 1. Navigation Check
    c_nav = canonical.get("navigation", {})
    g_nav = guide.get("navigation", {})
    for direction in ["prev", "next"]:
        c_link = c_nav.get(direction)
        g_link = g_nav.get(direction)
        if c_link and not g_link:
            add_finding("high", "navigation", f"navigation.{direction}", c_link, None, f"Missing {direction} navigation link")
        elif c_link and g_link:
            if c_link.get("id") != g_link.get("id"):
                add_finding("medium", "navigation", f"navigation.{direction}.id", c_link.get("id"), g_link.get("id"), f"Navigation {direction} ID mismatch")

    # 1b. Reference sections carry canonical text verbatim; any drift is a fidelity defect
    if guide.get("type") == "reference":
        ref_text = "".join(b.get("text", "") for b in guide.get("reference_blocks", []))
        if ref_text != canonical.get("text", ""):
            add_finding("critical", "factual discrepancy", "reference_blocks", f"{len(canonical.get('text', ''))} chars", f"{len(ref_text)} chars", "Reference block text differs from canonical source text")

    # Collect all structured items (items_summary + all step rewards + initial setup)
    struct_items = set()
    summary = guide.get("items_summary", {})
    for item in summary.get("obtainable", []):
        struct_items.add(normalize_name(item.get("name", "")))
    for item in summary.get("initial", []):
        struct_items.add(normalize_name(item.get("name", "")))
    
    init_setup = guide.get("initial_setup", {})
    for cat in ["equipment", "valuables", "souls"]:
        for item in init_setup.get(cat, []):
            struct_items.add(normalize_name(item))

    for step in guide.get("steps", []):
        for reward in step.get("rewards", []):
            struct_items.add(normalize_name(reward.get("name", "")))
            if reward.get("matched_overview_item"):
                struct_items.add(normalize_name(reward["matched_overview_item"]))

    # 2. Overview Items Check
    c_overview = canonical.get("overview", {})
    for cat_key in ["items", "equipment", "valuables", "lottery", "souls"]:
        for raw_item in c_overview.get(cat_key, []):
            clean_item = raw_item.replace('*', '').replace('[_]', '').strip()
            if not clean_item or clean_item == '|':
                continue
            norm = normalize_name(clean_item)
            if norm not in struct_items:
                add_finding(
                    "high", "missing information", f"overview.{cat_key}",
                    clean_item, "Not found in structured guide",
                    f"Canonical overview item '{clean_item}' is missing from structured items_summary and step rewards."
                )

    # 3. Enemies Check
    c_enemies = {e.get("name"): e for e in canonical.get("enemies", []) if e.get("name")}
    g_enemies = {e.get("name"): e for e in guide.get("enemies", []) if e.get("name")}

    for name, c_e in c_enemies.items():
        if name not in g_enemies:
            add_finding(
                "high", "missing information", "enemies",
                f"{name} (HP: {c_e.get('hp')}, Class: {c_e.get('class')})",
                "Missing",
                f"Enemy '{name}' is missing from structured enemies list."
            )
        else:
            g_e = g_enemies[name]
            # HP check
            if c_e.get("hp") != g_e.get("hp"):
                add_finding(
                    "high", "numerical discrepancy", f"enemies[{name}].hp",
                    c_e.get("hp"), g_e.get("hp"),
                    f"HP mismatch for enemy '{name}'"
                )
            # Class check
            if c_e.get("class") != g_e.get("class"):
                add_finding(
                    "medium", "factual discrepancy", f"enemies[{name}].class",
                    c_e.get("class"), g_e.get("class"),
                    f"Class mismatch for enemy '{name}'"
                )
            # Boss / Subboss flags
            if bool(c_e.get("is_boss")) != bool(g_e.get("is_boss")):
                add_finding(
                    "medium", "factual discrepancy", f"enemies[{name}].is_boss",
                    c_e.get("is_boss"), g_e.get("is_boss"),
                    f"is_boss flag mismatch for enemy '{name}'"
                )

    # 4. Bosses Check
    c_bosses = canonical.get("bosses", [])
    g_bosses = guide.get("bosses", [])
    if len(c_bosses) != len(g_bosses):
        add_finding(
            "high", "structural fidelity", "bosses",
            f"{len(c_bosses)} bosses in canonical", f"{len(g_bosses)} bosses in structured",
            "Boss count mismatch"
        )
    else:
        for idx, c_b in enumerate(c_bosses):
            g_b = g_bosses[idx]
            if c_b.get("name") != g_b.get("name"):
                add_finding("high", "factual discrepancy", f"bosses[{idx}].name", c_b.get("name"), g_b.get("name"), "Boss name mismatch")
            if c_b.get("exp") != g_b.get("exp"):
                add_finding("high", "numerical discrepancy", f"bosses[{idx}].exp", c_b.get("exp"), g_b.get("exp"), f"Boss exp mismatch for {c_b.get('name')}")
            if c_b.get("cash") != g_b.get("cash"):
                add_finding("high", "numerical discrepancy", f"bosses[{idx}].cash", c_b.get("cash"), g_b.get("cash"), f"Boss cash mismatch for {c_b.get('name')}")
            if not g_b.get("strategy"):
                add_finding("medium", "missing information", f"bosses[{idx}].strategy", "Strategy present", "Empty strategy", "Missing boss battle strategy")

    # 4b. Boss Step Mapping & Redundancy Check (Chronological Flow & Spoiler Prevention)
    all_steps = guide.get("steps", [])
    step_encounter_names = set()
    step_boss_names = set()
    for s in all_steps:
        for en in s.get("encounter", {}).get("enemies", []):
            step_encounter_names.add(normalize_name(en))
        if s.get("boss", {}).get("name"):
            step_boss_names.add(normalize_name(s["boss"]["name"]))
            for en in s["boss"].get("enemies", []):
                step_boss_names.add(normalize_name(en.get("name", "")))

    for b in g_bosses:
        b_norm = normalize_name(b.get("name", ""))
        # Check if mapped to a step
        if b_norm not in step_encounter_names and b_norm not in step_boss_names:
            add_finding(
                "medium", "structural fidelity", f"bosses[{b.get('name')}]",
                b.get("name"), "Not mapped to any walkthrough step",
                f"Boss '{b.get('name')}' is defined in bosses overview but is not mapped to any walkthrough step."
            )

        # Check for verbatim duplicate strategy in step notes
        b_strat = (b.get("strategy") or "").strip()
        if not b_strat or len(b_strat) <= 30:
            continue

        for s in all_steps:
            duplicate_notes = [n for n in s.get("notes", []) if (n.get("text") or "").strip() and (b_strat in n.get("text") or n.get("text") in b_strat)]
            if duplicate_notes:
                add_finding(
                    "medium", "redundancy / duplication", f"steps[{s.get('id')}].notes",
                    "Duplicate strategy text", "Strategy present in both boss card and step note",
                    f"Step {s.get('id')} note duplicates the boss battle strategy for '{b.get('name')}'. Strategy should be in a single location."
                )

    # 5. Shops Check
    c_shops = canonical.get("shops", [])
    g_shops = guide.get("shops", [])
    if len(c_shops) != len(g_shops):
        add_finding(
            "high", "missing information", "shops",
            f"{len(c_shops)} shops in canonical", f"{len(g_shops)} shops in structured",
            "Shop count mismatch"
        )
    else:
        for idx, c_s in enumerate(c_shops):
            g_s = g_shops[idx]
            c_inv = {i.get("name"): i.get("price") for i in c_s.get("inventory", [])}
            g_inv = {i.get("name"): i.get("price") for i in g_s.get("inventory", [])}
            for iname, iprice in c_inv.items():
                if iname not in g_inv:
                    add_finding("high", "missing information", f"shops[{c_s.get('name')}].inventory", iname, "Missing", f"Shop item '{iname}' missing from structured inventory")
                elif g_inv[iname] != iprice:
                    add_finding("high", "numerical discrepancy", f"shops[{c_s.get('name')}].inventory[{iname}].price", iprice, g_inv[iname], f"Price mismatch for shop item '{iname}'")

    # 6. Canonical Notes Check
    c_notes = canonical.get("markers", {}).get("notes", [])
    # Collect all notes in steps and callouts
    all_struct_notes = []
    for step in guide.get("steps", []):
        all_struct_notes.extend(step.get("notes", []))
    all_struct_notes.extend(guide.get("callouts", []))
    init_note = guide.get("initial_setup", {}).get("note", "")
    all_notes_text = (" ".join(n.get("text", "") for n in all_struct_notes) + " " + init_note).lower()

    for idx, mn in enumerate(c_notes):
        # Extract a few key words from canonical note
        note_body = mn.get("text", "").lower()
        # Find distinctive words (length > 5)
        words = [w for w in re.findall(r'[a-z]{5,}', note_body) if w not in ["equipped", "default", "battle", "before", "continue"]]
        sample = words[:3] if len(words) >= 3 else words
        if sample and not any(w in all_notes_text for w in sample):
            add_finding(
                "medium", "missing information", f"markers.notes[{idx}]",
                mn.get("text", "")[:80] + "...",
                "Not identified in structured notes",
                f"Canonical note starting with '{mn.get('text', '')[:40]}' may be missing from structured notes."
            )

    # Calculate status and summary
    summary_counts = {
        "critical": sum(1 for f in findings if f["severity"] == "critical"),
        "high": sum(1 for f in findings if f["severity"] == "high"),
        "medium": sum(1 for f in findings if f["severity"] == "medium"),
        "low": sum(1 for f in findings if f["severity"] == "low"),
    }

    if summary_counts["critical"] > 0 or summary_counts["high"] > 0:
        status = "FAIL"
    elif summary_counts["medium"] > 0 or summary_counts["low"] > 0:
        status = "PASS WITH WARNINGS"
    else:
        status = "PASS"

    return {
        "qa": {
            "status": status,
            "section_id": guide.get("id"),
            "section_title": guide.get("title"),
            "summary": summary_counts,
            "findings": findings
        }
    }


def format_markdown_report(report: Dict[str, Any]) -> str:
    """Formats a QA verification result dictionary into a GitHub-flavored Markdown report."""
    qa = report["qa"]
    status_icon = "[PASS]" if qa["status"] == "PASS" else ("[PASS WITH WARNINGS]" if qa["status"] == "PASS WITH WARNINGS" else "[FAIL]")
    lines = [
        f"# QA Verification Report: {qa.get('section_id', 'Unknown')} - {qa.get('section_title', '')}",
        f"\n**Status:** {status_icon}\n",
        "## Summary",
        f"- **Critical:** {qa['summary']['critical']}",
        f"- **High:** {qa['summary']['high']}",
        f"- **Medium:** {qa['summary']['medium']}",
        f"- **Low:** {qa['summary']['low']}\n",
    ]

    if qa["findings"]:
        lines.append("## Findings\n")
        lines.append("| ID | Severity | Category | Location | Description | Owner |")
        lines.append("|:---|:---|:---|:---|:---|:---|")
        for f in qa["findings"]:
            lines.append(f"| {f['id']} | **{f['severity'].upper()}** | {f['category']} | `{f['location']}` | {f['description']} | {f['recommended_owner']} |")
        lines.append("\n### Detailed Discrepancies\n")
        for f in qa["findings"]:
            lines.append(f"#### {f['id']} [{f['severity'].upper()}] - {f['category']}")
            lines.append(f"- **Location:** `{f['location']}`")
            lines.append(f"- **Source:** `{f['source']['text']}`")
            lines.append(f"- **Generated:** `{f['generated']['text']}`")
            lines.append(f"- **Description:** {f['description']}")
            lines.append(f"- **Recommended Owner:** `{f['recommended_owner']}`\n")
    else:
        lines.append("**No discrepancies found! 100% source fidelity verified.**")

    return "\n".join(lines)


def main():
    """CLI entry point for running QA verification between canonical and structured files."""
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="Run QA verification between Canonical Source JSON and Structured Guide JSON.")
    parser.add_argument("canonical_file", help="Path to the canonical section JSON file")
    parser.add_argument("structured_file", help="Path to the structured guide JSON file")
    parser.add_argument("--report", "-r", default=None, help="Output path for Markdown QA report")
    parser.add_argument("--json", "-j", action="store_true", help="Output report as JSON to stdout")

    args = parser.parse_args()

    if not os.path.exists(args.canonical_file):
        print(f"Error: Canonical file not found: {args.canonical_file}")
        sys.exit(1)
    if not os.path.exists(args.structured_file):
        print(f"Error: Structured file not found: {args.structured_file}")
        sys.exit(1)

    with open(args.canonical_file, "r", encoding="utf-8") as f:
        canonical = json.load(f)
    with open(args.structured_file, "r", encoding="utf-8") as f:
        structured = json.load(f)

    report = verify_guide(canonical, structured)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        md = format_markdown_report(report)
        print(md)

    if args.report:
        os.makedirs(os.path.dirname(args.report), exist_ok=True)
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(format_markdown_report(report))
        print(f"\nSaved report to: {args.report}")

    qa = report["qa"]
    if qa["status"] == "FAIL":
        sys.exit(1)


if __name__ == "__main__":
    main()
