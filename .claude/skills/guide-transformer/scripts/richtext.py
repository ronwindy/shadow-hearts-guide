#!/usr/bin/env python3
"""
richtext.py - helpers for structured rich text (string OR array of blocks).

A rich-text field (step description, note/callout text, boss strategy) is either a
markdown-lite string or an array of blocks:

    [{"text": "Intro"},
     {"list": "numbered", "items": [{"text": "A", "children": [{"list": "bullet", "items": [{"text": "a1"}]}]}]}]

`flatten_text` turns it into markdown-lite lines (2 spaces of indent per nesting level;
lines are in the depth-first reading order that `choices[].after_item` counts), so the
lint and QA tools can keep working on plain strings.
"""

import copy
from typing import Any, Dict, List


def flatten_text(value: Any) -> Any:
    """Returns a markdown-lite string for a block array; anything else is returned unchanged."""
    if not isinstance(value, list):
        return value
    lines: List[str] = []

    def walk_list(lst: Dict[str, Any], level: int) -> None:
        for n, item in enumerate(lst.get("items", []), start=1):
            mark = f"{n}." if lst.get("list") == "numbered" else "-"
            lines.append(f"{'  ' * level}{mark} {item.get('text', '')}")
            for child in item.get("children", []) or []:
                walk_list(child, level + 1)

    for block in value:
        if "list" in block:
            walk_list(block, 0)
        else:
            lines.append(block.get("text", ""))
    return "\n".join(lines)


def flatten_guide(guide: Dict[str, Any]) -> Dict[str, Any]:
    """Deep copy of `guide` with every rich-text field flattened to a string."""
    g = copy.deepcopy(guide)

    def boss(b: Any) -> None:
        if isinstance(b, dict) and "strategy" in b:
            b["strategy"] = flatten_text(b["strategy"])

    for step in g.get("steps", []) or []:
        if "description" in step:
            step["description"] = flatten_text(step["description"])
        for note in step.get("notes", []) or []:
            if "text" in note:
                note["text"] = flatten_text(note["text"])
        boss(step.get("boss"))
    for b in g.get("bosses", []) or []:
        boss(b)
    b = g.get("boss")
    for x in (b if isinstance(b, list) else [b]):
        boss(x)
    for call in g.get("callouts", []) or []:
        if "text" in call:
            call["text"] = flatten_text(call["text"])
    return g


_MD_LIST = None


def blocks_from_markdown(text: str) -> Any:
    """Inverse of flatten_text for nested lists.

    Returns a block array when `text` has a list line indented under another list line
    (2 spaces per level, at most 3 levels); otherwise returns `text` unchanged, so flat
    descriptions stay plain strings. Line order is preserved, so `after_item` anchors keep
    pointing at the same line.
    """
    import re
    global _MD_LIST
    if _MD_LIST is None:
        _MD_LIST = re.compile(r'^( *)(?:(-|\*)|(\d+)\.)\s+(\S.*)$')
    if not isinstance(text, str) or "\n" not in text:
        return text
    parsed = []
    nested = False
    for ln in text.split("\n"):
        m = _MD_LIST.match(ln)
        if not m:
            parsed.append(("p", 0, None, ln.strip()))
            continue
        level = len(m.group(1)) // 2
        if level > 2 or len(m.group(1)) % 2:
            return text  # deeper than the schema allows / irregular indent: keep flat
        kind = "numbered" if m.group(3) else "bullet"
        nested = nested or level > 0
        parsed.append(("l", level, kind, m.group(4)))
    if not nested or parsed[0][0] == "l" and parsed[0][1] > 0:
        return text
    blocks: List[Dict[str, Any]] = []
    lists: List[Dict[str, Any]] = []  # open list per nesting level
    items: List[Dict[str, Any]] = []  # last item per nesting level

    def new_list(level: int, kind: str) -> Dict[str, Any]:
        lst: Dict[str, Any] = {"list": kind, "items": []}
        if level == 0:
            blocks.append(lst)
        else:
            items[level - 1].setdefault("children", []).append(lst)
        return lst

    for tag, level, kind, body in parsed:
        if tag == "p":
            lists.clear()
            items.clear()
            blocks.append({"text": body})
            continue
        if level > len(lists):
            return text  # skipped a level
        del lists[level + 1:], items[level:]
        if level == len(lists) or lists[level]["list"] != kind:
            lst = new_list(level, kind)
            del lists[level:]
            lists.append(lst)
        item: Dict[str, Any] = {"text": body}
        lists[level]["items"].append(item)
        items.append(item)
    return blocks
