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


_CHOICE_LINE = re.compile(r'^\s*\[(\d+)\]\s+(\S.*?)\s*$')


def find_choice_blocks(text: str) -> List[Tuple[int, List[Dict[str, str]]]]:
    """Finds dialogue choice blocks (consecutive "[1] Option" lines).

    Returns [(first_line_number, [{"option": "1. Option"}, ...])]. `outcome` is deliberately
    never set: the source states outcomes in prose, so a human/LLM refiner adds them (or not).
    """
    blocks: List[Tuple[int, List[Dict[str, str]]]] = []
    current: List[Dict[str, str]] = []
    first = 0
    for i, line in enumerate(text.splitlines(), start=1):
        m = _CHOICE_LINE.match(line)
        if m:
            if not current:
                first = i
            current.append({"option": f"{m.group(1)}. {m.group(2)}"})
        elif current and not line.strip("—-_ \t"):
            continue  # rule line / blank inside a block
        elif current:
            blocks.append((first, current))
            current = []
    if current:
        blocks.append((first, current))
    return blocks


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

    return merge_broken_sentences(paragraphs)


NOTE_GAP = 4  # max lines between a paragraph's end and a NOTE box attached to it

_SENTENCE_END =('.', '!', '?', '"', "'", ')', ']', ':', '”')


def _is_note_paragraph(p_text: str) -> bool:
    return p_text.lstrip().startswith("NOTE")


def merge_broken_sentences(paragraphs: List[Tuple[int, int, str]]) -> List[Tuple[int, int, str]]:
    """Rejoins a sentence split by an interleaved table/ASCII-art block or stray blank line.

    A paragraph is merged into the previous one when the previous text does not end
    in sentence punctuation and the next one starts lowercase.
    """
    merged: List[Tuple[int, int, str]] = []
    for start, end, text in paragraphs:
        if merged:
            p_start, _, p_text = merged[-1]
            if (not _is_note_paragraph(p_text) and not _is_note_paragraph(text)
                    and not p_text.rstrip().endswith(_SENTENCE_END)
                    and text[:1].islower()):
                merged[-1] = (p_start, end, p_text + "\n" + text)
                continue
        merged.append((start, end, text))
    return merged


def is_heading_paragraph(p_text: str) -> bool:
    """Short title-like line (e.g. 'Sewers') with no sentence punctuation."""
    stripped = p_text.strip()
    return "\n" not in stripped and len(stripped.split()) <= 4 and not stripped.endswith(_SENTENCE_END)


def clean_note_text(text: str) -> str:
    """Strips [_TAG_] marks and trailing ASCII-art tables from a note."""
    text = re.sub(r'\[_([^_]+)_\]', r'\1', text.strip())
    text = re.split(r'\s_{5,}|\s\\[$/]', text)[0]
    return text.strip()


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


_FIGHT_CUE = re.compile(r'\b(fight|battle|combat|take on|face|defeat|boss)\b', re.I)
_PREP_CUE = re.compile(r'\b(prepared|prepare|ready|before)\b', re.I)
_SHOP_CUE = re.compile(r'\b(for sale|shop|store|merchant|peddler|buy|sells?)\b', re.I)
_STORY_CUE = re.compile(r'\b(scene|event|watch|cutscene|dialogue)\b', re.I)
_NAV_CUE = re.compile(r"^(head|go|make your way|travel|exit|leave|return|walk|proceed)\b", re.I)


def infer_step_type(p_text: str, bosses: List[Dict[str, Any]], has_rewards: bool, has_choices: bool) -> str:
    """Maps a paragraph to a schema `type` (see docs/structured-schema.md). Conservative on purpose."""
    if has_choices:
        return "dialogue"
    named_boss = any(
        b.get("name") and re.search(r'\b' + re.escape(b["name"]) + r'\b', p_text, re.I)
        for b in bosses
    )
    if named_boss and _FIGHT_CUE.search(p_text):
        return "boss"
    if re.search(r'\bboss\b', p_text, re.I) and _PREP_CUE.search(p_text):
        return "preparation"
    if _SHOP_CUE.search(p_text):
        return "shop"
    if re.search(r'\b(battle|fight|combat)\b', p_text, re.I):
        return "battle"
    if has_rewards and not re.search(r'\b(head|continue)\b', p_text, re.I):
        return "loot"
    if _STORY_CUE.search(p_text):
        return "story"
    if _NAV_CUE.match(p_text.strip()):
        return "navigation"
    return "exploration"


def _sentence_with(description: str, name: str) -> str:
    """First sentence of a step description that mentions `name` (case-insensitive), else ""."""
    needle = name.strip("() ").lower()
    if not needle:
        return ""
    for sent in re.split(r'(?<=[.!?])\s+', " ".join(description.split())):
        if needle in sent.lower():
            return re.sub(r'^\d+\.\s*', '', sent.strip())
    return ""


def fill_item_locations(items_summary: Dict[str, Any], steps: List[Dict[str, Any]]) -> None:
    """Fills obtainable[].location with the verbatim source sentence + "(step N)" where the item appears.

    Prefers the step that carries the item as a reward; falls back to the first step mentioning the name.
    Items not mentioned in any step text keep an empty location (never guessed).
    """
    def norm(n: str) -> str:
        return re.sub(r'[^a-z0-9]', '', n.lower())

    reward_step: Dict[str, Dict[str, Any]] = {}
    for st in steps:
        for r in st.get("rewards", []):
            reward_step.setdefault(norm(r.get("matched_overview_item") or r.get("name") or ""), st)

    for item in items_summary.get("obtainable", []):
        candidates = []
        if norm(item["name"]) in reward_step:
            candidates.append(reward_step[norm(item["name"])])
        candidates.extend(steps)
        for st in candidates:
            sent = _sentence_with(st["description"], item["name"])
            if sent:
                item["location"] = f"{sent} (step {st['id']})"
                break


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
    choice_blocks = find_choice_blocks(raw_text)

    steps: List[Dict[str, Any]] = []
    step_id = 1

    # Keep track of assigned markers
    assigned_items = set()
    assigned_notes = set()

    for p_idx, (start_line, end_line, p_text) in enumerate(paragraphs):
        next_start = paragraphs[p_idx + 1][0] if p_idx + 1 < len(paragraphs) else 10 ** 9
        # Check for NOTE headers in paragraph
        if _is_note_paragraph(p_text) or is_heading_paragraph(p_text):
            continue
        # Tail of a NOTE box that contains a blank line: already captured as a note
        probe = " ".join(p_text.split())[:40]
        if any(probe in " ".join(mn.get("text", "").split()) for mn in markers_notes):
            continue

        # Find items within start_line - 1 to end_line + 1
        step_rewards = []
        for idx, mi in enumerate(markers_items):
            m_line = mi.get("line", 0)
            if start_line - 1 <= m_line <= end_line + 1:
                assigned_items.add(idx)
                matched = mi.get("matched_overview_item")
                reward = {
                    "name": matched or mi.get("name") or "",
                    "category": mi.get("category") or "items",
                }
                if matched:
                    reward["matched_overview_item"] = matched
                step_rewards.append(reward)

        # Find notes within start_line - 1 to end_line + 1
        step_notes = []
        # A note belongs to the nearest preceding paragraph, and is attached only once
        for idx, mn in enumerate(markers_notes):
            n_line = mn.get("line", 0)
            if idx not in assigned_notes and start_line <= n_line <= end_line + NOTE_GAP:
                assigned_notes.add(idx)
                n_title = mn.get("type", "Note").title()
                n_text = clean_note_text(mn.get("text", ""))
                step_notes.append({
                    "type": infer_note_type(n_title, n_text),
                    "title": n_title,
                    "text": n_text
                })

        choices: List[Dict[str, str]] = []
        for first_line, block in choice_blocks:
            if end_line < first_line <= next_start:
                choices.extend(block)

        step_type = infer_step_type(p_text, canonical.get("bosses", []), bool(step_rewards), bool(choices))

        # Clean description text: strip [_TAG_] marks
        clean_desc = re.sub(r'\[_([^_]+)_\]', r'\1', p_text)
        # Collapse multiple spaces and newlines
        clean_desc = " ".join(clean_desc.split())

        step: Dict[str, Any] = {
            "id": step_id,
            "description": clean_desc,
            "type": step_type
        }

        p_lower = p_text.lower()
        # Check matching enemy encounter
        matched_enemies = []
        for enemy in canonical.get("enemies", []):
            if (enemy.get("name") or "").lower() in p_lower:
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
            n_text = clean_note_text(mn.get("text", ""))
            n_title = mn.get("type", "Note").title()
            if steps:
                steps[-1].setdefault("notes", []).append({
                    "type": infer_note_type(n_title, n_text),
                    "title": n_title,
                    "text": n_text
                })

    fill_item_locations(items_summary, steps)

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
