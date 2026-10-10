#!/usr/bin/env python3
"""
lint_guide.py - Presentation lint for structured guide JSON (not a fact check).

Flags text that the Guide Transformer should still have cleaned up:
  prose            paragraph with 3+ sentences or ~40+ words that is not a bullet/numbered list
  upper-item       item name left in UPPERCASE (e.g. TALISMANOFMERCY, B.DRAGON HORN)
  raw-tag          a leftover `[_TAG_]` source marker
  fragment         a step line that starts lowercase (a wrapped source line split off its sentence)
  mixed-list       a numbered item after a bullet in one step (a bullet's wrapped text leaked)
  ascii-border     ASCII-art border/box characters (`____`, `¯¯¯`, `.———`, `|` tables, `$$$$`)
  narrative-item   (info) reward/tag that is not in items_summary (overview omitted it)

Each finding is {"id", "check", "severity", "location", "text"}; severity is "warn" or "info".
"""

import re
from typing import Any, Dict, Iterable, List, Tuple

MAX_SENTENCES = 2   # 3+ sentences -> list
MAX_WORDS = 39      # ~40+ words  -> list

_LIST_LINE = re.compile(r'^\s*(?:[-*]\s+|\d+\.\s+)')
_SENTENCE_SPLIT = re.compile(r'(?<=[.!?])["\')\]]*\s+(?=["\'(\[*]*[A-Z0-9])')
_LIST_MARK = re.compile(r'^\s*(?:[-*]|\d+\.)\s+')
_RAW_TAG = re.compile(r'\[_[^\]]*_\]')
_ASCII = re.compile(r'(_{5,}|¯{3,}|—{5,}|-{5,}|={5,}|\$\$\$\$|\.—|—\.|\\\s*\$|^\s*\|.*\|\s*$)', re.M)
_UPPER_RUN = re.compile(r"\b[A-Z][A-Z.'’]*(?:[ ][A-Z][A-Z.'’]*)*\b")
_ACRONYMS = {"EXP", "HP", "MP", "SP", "NOTE", "BOSS", "SUB-BOSS", "ATK", "DEF", "OK", "TV", "NPC", "VS"}


def _norm(name: str) -> str:
    return re.sub(r'[^a-z0-9]', '', name.lower())


def _plain(text: str) -> str:
    return re.sub(r'\*\*|__|`', '', text)


def _texts(guide: Dict[str, Any]) -> Iterable[Tuple[str, str]]:
    """Yields (location, text) for every prose field in the guide."""
    for step in guide.get("steps", []):
        sid = step.get("id")
        yield f"step {sid}", step.get("description", "")
        for n_idx, note in enumerate(step.get("notes", []), start=1):
            yield f"step {sid} note {n_idx}", note.get("text", "")
        boss = step.get("boss")
        if isinstance(boss, dict):
            yield f"step {sid} boss {boss.get('name', '')}", boss.get("strategy", "") or ""
    for b in guide.get("bosses", []) or []:
        yield f"boss {b.get('name', '')}", b.get("strategy", "") or ""
    for c_idx, call in enumerate(guide.get("callouts", []) or [], start=1):
        yield f"callout {c_idx}", call.get("text", "")
    for loc_idx, item in enumerate(guide.get("items_summary", {}).get("obtainable", []), start=1):
        yield f"items_summary {item.get('name', loc_idx)}", item.get("location", "") or ""


def _known_names(guide: Dict[str, Any]) -> set:
    names = set()
    summary = guide.get("items_summary", {})
    for key in ("obtainable", "initial"):
        names.update(_norm(i.get("name", "")) for i in summary.get(key, []))
    for shop in guide.get("shops", []):
        names.update(_norm(i.get("name", "")) for i in shop.get("inventory", []))
    for step in guide.get("steps", []):
        names.update(_norm(r.get("name", "")) for r in step.get("rewards", []))
    names.discard("")
    return names


def lint_guide(guide: Dict[str, Any]) -> List[Dict[str, str]]:
    findings: List[Dict[str, str]] = []

    def add(check: str, severity: str, loc: str, text: str) -> None:
        findings.append({"id": f"L{len(findings) + 1:03d}", "check": check, "severity": severity,
                         "location": loc, "text": " ".join(text.split())[:140]})

    known = _known_names(guide)
    for loc, raw in _texts(guide):
        if not raw:
            continue
        if _RAW_TAG.search(raw):
            add("raw-tag", "warn", loc, _RAW_TAG.search(raw).group(0))
        if _ASCII.search(raw):
            add("ascii-border", "warn", loc, _ASCII.search(raw).group(0))
        if loc.startswith("items_summary"):
            continue  # a `location` is one verbatim sentence; list/upper checks are for prose
        # Prose blocks: separated by blank lines, skipping list items
        for block in re.split(r'\n\s*\n', raw):
            lines = [l for l in block.splitlines() if l.strip()]
            if not lines or any(_LIST_LINE.match(l) for l in lines):
                continue
            text = _plain(" ".join(l.strip() for l in lines))
            sentences = [s for s in _SENTENCE_SPLIT.split(text) if s.strip()]
            words = len(text.split())
            if len(sentences) > MAX_SENTENCES or words > MAX_WORDS:
                add("prose", "warn", loc, f"{len(sentences)} sentences / {words} words: {text}")
        if loc.count(" ") == 1:  # step description only (not notes / boss strategy)
            seen_bullet = False
            for line in raw.splitlines():
                if not line.strip():
                    continue
                body = _plain(_LIST_MARK.sub("", line)).lstrip(" \"'([")
                if body[:1].islower():
                    add("fragment", "warn", loc, line.strip())
                if re.match(r'^\s*\d+\.\s', line) and seen_bullet:
                    add("mixed-list", "warn", loc, line.strip())
                if re.match(r'^\s*[-*]\s', line):
                    seen_bullet = True
        plain = _plain(raw)
        for m in _UPPER_RUN.finditer(plain):
            run = m.group(0)
            letters = re.sub(r'[^A-Za-z]', '', run)
            if len(letters) < 5 or run in _ACRONYMS:
                continue
            # a known item name, or a dotted/multi-word run, is an item tag left in caps
            if _norm(run) in known or '.' in run.strip('.') or (' ' in run and len(letters) >= 8):
                add("upper-item", "warn", loc, run)

    # items tagged in the text but missing from the overview-derived items_summary
    listed = set()
    summary = guide.get("items_summary", {})
    for key in ("obtainable", "initial"):
        listed.update(_norm(i.get("name", "")) for i in summary.get(key, []))
    seen = set()
    for step in guide.get("steps", []):
        for r in step.get("rewards", []):
            key = _norm(r.get("name", ""))
            if key and key not in listed and key not in seen:
                seen.add(key)
                add("narrative-item", "info", f"step {step.get('id')}",
                    f"{r.get('name')} is a reward here but is not in items_summary (overview omits it)")
    return findings
