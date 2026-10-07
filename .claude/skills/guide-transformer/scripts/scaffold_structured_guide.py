#!/usr/bin/env python3
"""
scaffold_structured_guide.py - Automated Scaffolding for Structured Game Guides

Takes a canonical section JSON file and generates a structured guide JSON draft:
1. Copies core metadata, enemies, bosses, shops, and navigation verbatim.
2. Compiles items_summary from overview items, equipment, valuables, and lottery.
3. Parses narrative text paragraphs and pre-associates canonical markers.items and markers.notes.
4. Detects choices and battle encounters.
5. Emits a valid structured guide draft ready for Guide Transformer refinement.
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple


def clean_overview_item(raw_name: str) -> Tuple[str, bool]:
    """Cleans an overview item name and checks if it was marked as initial (*)."""
    is_initial = '*' in raw_name
    cleaned = raw_name.replace('*', '').replace('[_]', '').strip()
    return cleaned, is_initial


def build_items_summary(canonical: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts obtainable and initial item lists from canonical overview metadata."""
    overview = canonical.get("overview", {})
    obtainable = []
    initial = []

    # Map categories
    categories = [
        ("items", "items"),
        ("equipment", "equipment"),
        ("valuables", "valuables"),
        ("lottery", "lottery"),
        ("souls", "souls"),
    ]

    for cat_key, cat_name in categories:
        for item in overview.get(cat_key, []):
            cleaned, is_init = clean_overview_item(item)
            if not cleaned or cleaned == '|':
                continue
            if is_init:
                initial.append({"name": cleaned, "category": cat_name})
            else:
                obtainable.append({"name": cleaned, "category": cat_name, "location": ""})

    summary: Dict[str, Any] = {"obtainable": obtainable}
    if initial:
        summary["initial"] = initial
    return summary


def infer_note_type(title: str, text: str) -> str:
    text_lower = (title + " " + text).lower()
    if any(k in text_lower for k in ["impossible", "cannot be defeated", "tough", "dangerous", "remove", "missable", "warning", "beware"]):
        return "warning"
    if any(k in text_lower for k in ["mechanic", "how to", "tutorial", "skill"]):
        return "tutorial"
    return "tip"


def parse_choices(text: str) -> List[Dict[str, str]]:
    """Detects bracketed choices like [1] No, I don't... [2] Yes, I do!"""
    pattern = re.compile(r'\[([0-9]+)\]\s*([^\[\n\r]+)')
    matches = pattern.findall(text)
    choices = []
    for num, option in matches:
        opt_text = option.strip()
        choices.append({
            "option": f"[{num}] {opt_text}",
            "outcome": ""
        })
    return choices


def is_header_or_table_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if '|' in s:
        return True
    if s.startswith(('___', '===', '---', '¯¯¯', '.——', '\'——', '——', '\\', '/', '-$-')):
        return True
    if re.match(r'^(?:#\d{3}|Enemy|Save Points|Items|Equipment|Valuables|Souls|Cash|Lottery)\b', s):
        return True
    if re.match(r'^(?:Shadow Hearts|\[[A-Z0-9-]+\])', s):
        return True
    return False


def split_text_paragraphs(text: str) -> List[Tuple[int, int, str]]:
    """
    Splits text into paragraphs, returning (start_line, end_line, text).
    Lines are 1-indexed.
    """
    lines = text.splitlines()
    paragraphs = []
    current_lines = []
    start_line = 0

    for i, line in enumerate(lines, start=1):
        if is_header_or_table_line(line):
            if current_lines:
                end_line = i - 1
                p_text = "\n".join(current_lines).strip()
                if p_text:
                    paragraphs.append((start_line, end_line, p_text))
                current_lines = []
                start_line = 0
            continue

        if not line.strip():
            if current_lines:
                end_line = i - 1
                p_text = "\n".join(current_lines).strip()
                if p_text:
                    paragraphs.append((start_line, end_line, p_text))
                current_lines = []
                start_line = 0
        else:
            if not current_lines:
                start_line = i
            current_lines.append(line)

    if current_lines:
        end_line = len(lines)
        p_text = "\n".join(current_lines).strip()
        if p_text:
            paragraphs.append((start_line, end_line, p_text))

    return paragraphs


def is_reference_section(canonical: Dict[str, Any]) -> bool:
    """Appendix/reference sections are table-heavy and are scaffolded without LLM refinement."""
    sec_id = canonical.get("id", "")
    return sec_id.startswith("a-1-") and sec_id != "a-1-00"


def scaffold_reference_guide(canonical: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic scaffold: canonical text is carried over byte-for-byte, no steps or prose."""
    source = canonical["source"]
    guide: Dict[str, Any] = {
        "id": canonical.get("id"),
        "code": canonical.get("code"),
        "title": canonical.get("title"),
        "type": "reference",
        "category": canonical.get("category"),
        "source": {
            "game": source.get("game", "Shadow Hearts"),
            "author": source.get("author", "A_Backdated_Future"),
            "version": source.get("version", "1.05"),
            "url": source.get("source_url", ""),
            "source_file": source.get("source_file", "")
        },
        "navigation": canonical.get("navigation", {}),
        "enemies": canonical.get("enemies", []),
        "bosses": canonical.get("bosses", []),
        "shops": canonical.get("shops", []),
        "reference_blocks": [{"format": "preformatted", "text": canonical.get("text", "")}],
    }
    if canonical.get("boss"):
        guide["boss"] = canonical["boss"]
    return {"guide": guide}


def scaffold_guide(canonical_path: str) -> Dict[str, Any]:
    """Generates structured guide draft dictionary from canonical JSON artifact."""
    with open(canonical_path, "r", encoding="utf-8") as f:
        canonical = json.load(f)

    if is_reference_section(canonical):
        return scaffold_reference_guide(canonical)

    # Determine type
    guide_type = "walkthrough"
    if canonical.get("is_sidequest"):
        guide_type = "sidequest"
    elif canonical.get("overview", {}).get("directions"):
        guide_type = "walkthrough_intro"

    # Route candidates
    route = []
    save_points = canonical.get("overview", {}).get("save_points", [])
    for sp in save_points:
        clean_sp = sp.strip().strip('|').strip()
        if clean_sp and clean_sp not in route:
            route.append(clean_sp)
    if not route:
        route = [canonical.get("title", "Area")]

    # Objectives placeholder / inference
    objectives = []
    for b in canonical.get("bosses", []):
        objectives.append(f"Defeat {b.get('name')}")
    if canonical.get("navigation", {}).get("next"):
        next_title = canonical["navigation"]["next"]["title"]
        objectives.append(f"Proceed to {next_title}")
    if not objectives:
        objectives = [f"Complete exploration of {canonical.get('title')}"]

    items_summary = build_items_summary(canonical)

    # Align markers with paragraphs
    markers_items = canonical.get("markers", {}).get("items", [])
    markers_notes = canonical.get("markers", {}).get("notes", [])
    raw_text = canonical.get("text", "")

    paragraphs = split_text_paragraphs(raw_text)

    steps: List[Dict[str, Any]] = []
    step_id = 1

    # Keep track of assigned markers
    assigned_items = set()
    assigned_notes = set()

    for start_line, end_line, p_text in paragraphs:
        # Check for NOTE headers in paragraph
        if p_text.startswith("NOTE") or p_text.startswith("  NOTE"):
            continue

        # Find items within start_line - 1 to end_line + 1
        step_rewards = []
        for idx, mi in enumerate(markers_items):
            m_line = mi.get("line", 0)
            if start_line - 1 <= m_line <= end_line + 1:
                assigned_items.add(idx)
                step_rewards.append({
                    "name": mi.get("matched_overview_item", mi.get("name")),
                    "category": mi.get("category", "items"),
                    "matched_overview_item": mi.get("matched_overview_item", mi.get("name"))
                })

        # Find notes within start_line - 1 to end_line + 1
        step_notes = []
        for idx, mn in enumerate(markers_notes):
            n_line = mn.get("line", 0)
            if start_line - 2 <= n_line <= end_line + 2:
                assigned_notes.add(idx)
                n_title = mn.get("type", "Note").title()
                n_text = mn.get("text", "").strip()
                # Clean [_TAG_] from note text
                n_text = re.sub(r'\[_([^_]+)_\]', r'\1', n_text)
                step_notes.append({
                    "type": infer_note_type(n_title, n_text),
                    "title": n_title,
                    "text": n_text
                })

        # Infer step type
        step_type = "exploration"
        encounter = None

        p_lower = p_text.lower()
        if "boss" in p_lower or any(b.get("name", "").lower() in p_lower for b in canonical.get("bosses", [])):
            step_type = "boss"
        elif "battle" in p_lower or "fight" in p_lower or any(e.get("name", "").lower() in p_lower for e in canonical.get("enemies", [])):
            step_type = "battle"
        elif step_rewards and not ("head" in p_lower or "continue" in p_lower):
            step_type = "loot"
        elif "shop" in p_lower or "merchant" in p_lower or "peddler" in p_lower:
            step_type = "shop"
        elif "scene" in p_lower or "event" in p_lower or "watch" in p_lower:
            step_type = "story"

        # Check for choices
        choices = parse_choices(p_text)

        # Clean description text: strip [_TAG_] marks
        clean_desc = re.sub(r'\[_([^_]+)_\]', r'\1', p_text)
        # Collapse multiple spaces and newlines
        clean_desc = " ".join(clean_desc.split())

        step: Dict[str, Any] = {
            "id": step_id,
            "description": clean_desc,
            "type": step_type
        }

        # Check matching enemy encounter
        matched_enemies = []
        for enemy in canonical.get("enemies", []):
            if enemy.get("name", "").lower() in p_lower:
                matched_enemies.append(enemy.get("name"))
        if matched_enemies:
            step["encounter"] = {"enemies": list(dict.fromkeys(matched_enemies))}

        if choices:
            step["choices"] = choices

        if step_notes:
            step["notes"] = step_notes

        step["rewards"] = step_rewards

        steps.append(step)
        step_id += 1

    # Attach any unassigned notes
    for idx, mn in enumerate(markers_notes):
        if idx not in assigned_notes:
            n_text = re.sub(r'\[_([^_]+)_\]', r'\1', mn.get("text", "").strip())
            n_title = mn.get("type", "Note").title()
            if steps:
                steps[-1].setdefault("notes", []).append({
                    "type": infer_note_type(n_title, n_text),
                    "title": n_title,
                    "text": n_text
                })

    guide_dict: Dict[str, Any] = {
        "guide": {
            "id": canonical.get("id"),
            "code": canonical.get("code"),
            "title": canonical.get("title"),
            "type": guide_type,
            "category": canonical.get("category"),
            "source": {
                "game": canonical["source"].get("game", "Shadow Hearts"),
                "author": canonical["source"].get("author", "A_Backdated_Future"),
                "version": canonical["source"].get("version", "1.05"),
                "url": canonical["source"].get("source_url", ""),
                "source_file": canonical["source"].get("source_file", "")
            },
            "navigation": canonical.get("navigation", {}),
            "route": route,
            "objectives": objectives,
            "items_summary": items_summary,
            "enemies": canonical.get("enemies", []),
            "bosses": canonical.get("bosses", []),
            "shops": canonical.get("shops", []),
            "steps": steps
        }
    }

    if canonical.get("boss"):
        guide_dict["guide"]["boss"] = canonical.get("boss")

    return guide_dict


def main():
    """CLI entry point for scaffolding a structured guide JSON draft."""
    parser = argparse.ArgumentParser(description="Scaffold a structured guide JSON from a canonical section JSON.")
    parser.add_argument("canonical_file", help="Path to the canonical section JSON file")
    parser.add_argument("--output", "-o", default=None, help="Output path for the structured guide JSON")

    args = parser.parse_args()

    if not os.path.exists(args.canonical_file):
        print(f"Error: Canonical file not found: {args.canonical_file}")
        sys.exit(1)

    result = scaffold_guide(args.canonical_file)

    if args.output:
        output_path = args.output
    else:
        out_name = os.path.basename(args.canonical_file)
        workspace_root = Path(__file__).resolve().parents[3]
        output_path = str(workspace_root / "structured-content" / "sections" / out_name)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Successfully scaffolded structured guide draft: {output_path}")


if __name__ == "__main__":
    main()
