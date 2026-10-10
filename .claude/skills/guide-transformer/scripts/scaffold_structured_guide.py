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


# --- ASCII info boxes (lottery prize table, footnote, boss card) -----------------------------
_LOTTERY_ROW = re.compile(r'\(([^)]+)\)\s*\|\s*(.*?)\s*[/\\]*\s*$')
_LOTTERY_TITLE = re.compile(r'\[_([^_]+)_\]')
_FOOTNOTE_START = re.compile(r'^\s{0,4}\*\s+-\s+(\S.*)$')
_CARD_TAG = re.compile(r'\*+\s*(SUB-BOSS|BOSS)\s*\*+')
_CARD_ROW = re.compile(r'^\|\s*(.+?)\s*\|\s*(\d+)\s*HP\s*\|\s*Class:\s*(\w+)\s*\|\s*\[_\]\s*(.*?)\s*\|\s*$')
_CARD_EXPCASH = re.compile(r'(\d+)\s*EXP\s*/.*?(\d+)\s*Cash')


def _find_boxes(lines: List[str]) -> List[Dict[str, Any]]:
    """Locates info boxes in the source text. Returns [{kind, start, end, data}] (1-indexed lines).

    kinds: "lottery" (prize table), "footnote" (`* - ...`), "boss_card" (SUB-BOSS / BOSS card).
    """
    boxes: List[Dict[str, Any]] = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        # Lottery member prize table: starts with the `\$$$$ ... $$$$/` banner, ends at the ¯¯¯ rule.
        if re.match(r'^\s*_{20,}\s*$', line) and i + 1 < n and re.match(r'^\s*\\\$\$\$\$', lines[i + 1]):
            j, title, rows = i + 1, "", []
            while j < n and lines[j].strip():
                tm = _LOTTERY_TITLE.search(lines[j])
                if tm and not title:
                    title = tm.group(1)
                rm = _LOTTERY_ROW.search(lines[j])
                if rm:
                    rows.append({"range": rm.group(1).strip(), "reward": rm.group(2).strip()})
                j += 1
            boxes.append({"kind": "lottery", "start": i + 1, "end": j,
                          "data": {"title": title, "rows": rows}})
            i = j
            continue
        # Footnote: "* - text" followed by indented continuation lines.
        fm = _FOOTNOTE_START.match(line)
        if fm:
            parts, j = [fm.group(1).strip()], i + 1
            while j < n and lines[j].strip() and lines[j].startswith('   '):
                parts.append(lines[j].strip())
                j += 1
            boxes.append({"kind": "footnote", "start": i + 1, "end": j, "data": {"text": " ".join(parts)}})
            i = j
            continue
        # Boss card: `.———.` / `/ * SUB-BOSS * \` ... down to the EXP/Cash tail.
        cm = _CARD_TAG.search(line)
        if cm and i + 1 < n and lines[i + 1].lstrip().startswith('.'):
            start = i - 1 if i > 0 and lines[i - 1].strip().startswith('.') else i
            j, enemies, strat, tail = i + 1, [], [], False
            while j < n and lines[j].strip():
                row = _CARD_ROW.match(lines[j].strip())
                if row:
                    enemies.append({"name": row.group(1), "hp": int(row.group(2)),
                                    "class": row.group(3), "drop": row.group(4) or None})
                else:
                    sm = re.match(r'^\|\s{2}(\S.*?)\s*\|\s*$', lines[j].strip())
                    if sm and not re.match(r'^[.|=\'—\s]+$', sm.group(1)):
                        strat.append(sm.group(1))
                    em = _CARD_EXPCASH.search(lines[j]) if lines[j].strip().startswith('\\') else None
                    if em:
                        tail = (int(em.group(1)), int(em.group(2)))
                j += 1
            end = j
            card: Dict[str, Any] = {"type": cm.group(1), "name": enemies[0]["name"] if enemies else "",
                                    "enemies": enemies}
            if tail:
                card["exp"], card["cash"] = tail
            card["strategy"] = "\n".join(f"- {s}" for s in _strategy_sentences(strat))
            boxes.append({"kind": "boss_card", "start": start + 1, "end": end, "data": card})
            i = j
            continue
        i += 1
    return boxes


def _strategy_sentences(rows: List[str]) -> List[str]:
    """Re-joins the card's wrapped strategy lines and splits them into one sentence per item."""
    text = " ".join(r for r in rows if r)
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z])', text) if s.strip()]


def _blank_boxes(lines: List[str], boxes: List[Dict[str, Any]]) -> List[str]:
    out = list(lines)
    for b in boxes:
        for ln in range(b["start"], b["end"] + 1):
            out[ln - 1] = ""
    return out


def _norm_name(name: str) -> str:
    return re.sub(r'[^a-z0-9]', '', name.lower())


_GLOBAL_NAMES: Optional[Dict[str, str]] = None


def _global_name_index() -> Dict[str, str]:
    """Properly-cased item names from every canonical section (overview, shops, boss drops).

    Only used as a fallback when a tag's name is not cased in the current section.
    """
    global _GLOBAL_NAMES
    if _GLOBAL_NAMES is None:
        from collections import Counter
        votes: Dict[str, Counter] = {}
        sections = Path(__file__).resolve().parents[4] / "canonical-sources" / "sections"
        for f in sections.glob("*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            for n in _section_names(d):
                votes.setdefault(_norm_name(n), Counter())[n] += 1
        _GLOBAL_NAMES = {k: v.most_common(1)[0][0] for k, v in votes.items()}
    return _GLOBAL_NAMES


def _section_names(canonical: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    for cat in ("items", "equipment", "valuables", "lottery", "souls"):
        for raw in canonical.get("overview", {}).get(cat, []):
            c, _ = clean_overview_item(raw)
            if c and c != '|':
                names.append(c)
    for shop in canonical.get("shops", []):
        names.extend(i["name"] for i in shop.get("inventory", []) if i.get("name"))
    for b in canonical.get("bosses", []):
        names.extend(e["drop"] for e in b.get("enemies", []) if e.get("drop"))
    return names


def build_name_cases(canonical: Dict[str, Any]) -> Dict[str, str]:
    """normalized-name -> properly-cased name: this section's overview/shops first, then project-wide."""
    cases: Dict[str, str] = dict(_global_name_index())
    for n in _section_names(canonical):
        cases[_norm_name(n)] = n
    return cases


def fix_tag_case(text: str, cases: Dict[str, str]) -> str:
    """Replaces `[_TAG_]` with the properly-cased item name when one is known (else the tag text)."""
    def repl(m: "re.Match[str]") -> str:
        raw = m.group(1)
        return cases.get(_norm_name(raw), raw)
    return re.sub(r'\[_([^_]+)_\]', repl, text)



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
    lines = _blank_boxes(text.splitlines(), _find_boxes(text.splitlines()))
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
_SHOP_CUE = re.compile(r'\b(for sale|shop|store|buy|buying|purchase|sells?)\b', re.I)
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
    # Items tagged in the text make it a loot step; "shop" only when buying is the point.
    if _SHOP_CUE.search(p_text) and not has_rewards:
        return "shop"
    if re.search(r'\b(battle|fight|combat)\b', p_text, re.I):
        return "battle"
    if has_rewards:
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

    # Steps that award each item, in order; the k-th overview entry of a name takes the k-th step.
    reward_steps: Dict[str, List[Dict[str, Any]]] = {}
    for st in steps:
        seen = set()
        for r in st.get("rewards", []):
            key = norm(r.get("matched_overview_item") or r.get("name") or "")
            if key not in seen:
                seen.add(key)
                reward_steps.setdefault(key, []).append(st)

    occurrence: Dict[str, int] = {}
    for item in items_summary.get("obtainable", []):
        key = norm(item["name"])
        k = occurrence.get(key, 0)
        occurrence[key] = k + 1
        candidates = []
        if k < len(reward_steps.get(key, [])):
            candidates.append(reward_steps[key][k])
        candidates.extend(steps)
        for st in candidates:
            sent = _sentence_with(st["description"], item["name"])
            if sent:
                item["location"] = f"{sent} (step {st['id']})"
                break


def _title_case_tag(raw: str) -> str:
    return " ".join(w.capitalize() for w in raw.split())


def _attach_boxes(boxes: List[Dict[str, Any]], paragraphs: List[Tuple[int, int, str]],
                  para_step: Dict[int, Dict[str, Any]], steps: List[Dict[str, Any]],
                  canonical: Dict[str, Any], cases: Dict[str, str]) -> None:
    """Attaches lottery tables, footnotes and boss cards to the step whose paragraph precedes them."""
    boss_names = {(b.get("name") or "").lower() for b in canonical.get("bosses", [])}
    for b in boxes:
        owner = [i for i, p in enumerate(paragraphs) if p[0] <= b["start"] and i in para_step]
        if owner:
            step = para_step[owner[-1]]
        elif steps:
            step = steps[0]
        else:
            continue
        data = b["data"]
        if b["kind"] == "lottery":
            def recase(r: str) -> str:
                star = "*" if r.startswith("*") else ""
                body = r[len(star):]
                return star + cases.get(_norm_name(body), body)
            title = _title_case_tag(data["title"]) or "Lottery"
            step.setdefault("notes", []).append({
                "type": "tip",
                "title": f"{title} Prizes",
                "text": f"Prize listing for {title}, by color.",
                "table": {
                    "headers": ["Color", "Prize"],
                    "rows": [{"range": r["range"], "reward": recase(r["reward"])} for r in data["rows"]],
                },
            })
        elif b["kind"] == "footnote":
            text = fix_tag_case(data["text"], cases)
            kind = "discrepancy" if re.search(r'\b(however|instead|actually)\b', text, re.I) else "tip"
            step.setdefault("notes", []).append({"type": kind, "title": "Footnote", "text": text})
        elif b["kind"] == "boss_card" and data.get("name"):
            if data["name"].lower() in boss_names:
                continue  # already a canonical boss card
            card = dict(data)
            card["enemies"] = [dict(e, drop=cases.get(_norm_name(e["drop"]), e["drop"]) if e.get("drop") else None)
                               for e in card["enemies"]]
            card["strategy"] = fix_tag_case(card.get("strategy", ""), cases)
            step["boss"] = card
            if step["type"] in ("battle", "exploration", "story", "preparation"):
                step["type"] = "boss"


def merge_across_info_boxes(paragraphs: List[Tuple[int, int, str]],
                           boxes: List[Dict[str, Any]]) -> List[Tuple[int, int, str]]:
    """Merges the paragraph that follows a lottery table / footnote into the one before it.

    Those boxes sit in the middle of a scene ("... he's a Lottery Member!" [prize box] "The ring
    here moves REALLY fast ..."), so the text on both sides is one step. Boss cards are not
    merged: a card ends its fight step.
    """
    info = sorted((b for b in boxes if b["kind"] in ("lottery", "footnote")), key=lambda b: b["start"])
    clusters: List[Tuple[int, int]] = []
    for b in info:
        if clusters and b["start"] - clusters[-1][1] <= 3:
            clusters[-1] = (clusters[-1][0], max(clusters[-1][1], b["end"]))
        else:
            clusters.append((b["start"], b["end"]))
    result = list(paragraphs)
    for c_start, c_end in clusters:
        prev = next((i for i in range(len(result) - 1, -1, -1) if result[i][1] < c_start), None)
        nxt = next((i for i, p in enumerate(result) if p[0] > c_end), None)
        if prev is None or nxt is None or result[nxt][0] - c_end > 3:
            continue
        if _is_note_paragraph(result[prev][2]) or _is_note_paragraph(result[nxt][2]):
            continue
        p_start, _, p_text = result[prev]
        _, n_end, n_text = result[nxt]
        result[prev] = (p_start, n_end, p_text + "\n" + n_text)
        del result[nxt]
    return result


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

    # The overview's Save Points are save points, not a route: leave `route` empty unless the
    # source states one (a refiner fills it by hand).
    route: List[str] = []

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

    boxes = _find_boxes(raw_text.splitlines())
    paragraphs = merge_across_info_boxes(split_text_paragraphs(raw_text), boxes)
    box_lines = {ln for b in boxes for ln in range(b["start"], b["end"] + 1)}
    choice_blocks = find_choice_blocks(raw_text)
    cases = build_name_cases(canonical)
    para_step: Dict[int, Dict[str, Any]] = {}
    step_enemies: Dict[int, List[str]] = {}

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
            if m_line in box_lines:
                continue  # tag inside a prize table / card: the box carries it
            if start_line - 1 <= m_line <= end_line + 1:
                assigned_items.add(idx)
                matched = mi.get("matched_overview_item")
                raw_name = mi.get("name") or ""
                reward = {
                    "name": matched or cases.get(_norm_name(raw_name), raw_name),
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
                n_text = clean_note_text(fix_tag_case(mn.get("text", ""), cases))
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
        clean_desc = fix_tag_case(p_text, cases)
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
            step_enemies[step_id] = list(dict.fromkeys(matched_enemies))

        if choices:
            step["choices"] = choices

        if step_notes:
            step["notes"] = step_notes

        step["rewards"] = step_rewards

        steps.append(step)
        para_step[p_idx] = step
        step_id += 1

    # Attach any unassigned notes
    for idx, mn in enumerate(markers_notes):
        if idx not in assigned_notes:
            n_text = clean_note_text(fix_tag_case(mn.get("text", ""), cases))
            n_title = mn.get("type", "Note").title()
            if steps:
                steps[-1].setdefault("notes", []).append({
                    "type": infer_note_type(n_title, n_text),
                    "title": n_title,
                    "text": n_text
                })

    _attach_boxes(boxes, paragraphs, para_step, steps, canonical, cases)

    # An encounter is only recorded for fight steps: a name in a shop or story step ("Wugui is
    # gone") is not a fight.
    for st in steps:
        names = list(step_enemies.get(st["id"], []))
        if st["type"] in ("battle", "boss"):
            if st.get("boss"):
                known = {(e.get("name") or "").lower(): e.get("name") for e in canonical.get("enemies", [])}
                for e in st["boss"].get("enemies", []):
                    if (e.get("name") or "").lower() in known:
                        names.append(known[e["name"].lower()])
            names = list(dict.fromkeys(names))
            if names:
                st["encounter"] = {"enemies": names}

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
