"""
text_fidelity.py - Ordered word diff between canonical prose and structured step text.

The field checks in verify_guide.py compare numbers stored in structured fields (HP, prices).
This module covers the prose: each step line and note is aligned against the canonical
walkthrough prose (box/table/border lines removed) and reports
- altered:     a replaced or added word that is a number, a polarity word or a bolded term
               (altered-high when a number/polarity word is swapped for another: nine -> seven)
- order:       consecutive step lines whose canonical positions go backwards
- omitted:     canonical prose sentences inside the walkthrough span that no line covers
- unsupported: a step line or note with no matching canonical prose
Rewording that only drops or swaps filler words is tolerated.
"""

import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Tuple

NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "twenty", "thirty", "fifty",
    "hundred", "thousand", "first", "second", "third", "fourth", "fifth", "once", "twice",
    "double", "doubles", "triple", "triples", "half", "all", "both", "every", "each",
}
POLARITY_WORDS = {
    "not", "no", "never", "won't", "can't", "cannot", "don't", "doesn't", "isn't", "aren't",
    "didn't", "wouldn't", "shouldn't", "couldn't", "without", "also", "always", "only",
    "must", "before", "after", "until", "unless", "left", "right", "up", "down", "north",
    "south", "east", "west", "upper", "lower", "top", "bottom",
}
SIGNIFICANT = NUMBER_WORDS | POLARITY_WORDS

_BORDER = re.compile(r"[=_\-~*#.'\\/]{4,}|[^\x00-\x7F]{3,}")
_XREF = re.compile(r"\*\*\[[A-Z](?:-[0-9A-Z]+)+\][^*]*\*\*|\[[A-Z](?:-[0-9A-Z]+)+\]")
_WORD = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")


def _tokens(text: str) -> List[str]:
    text = re.sub(r"\*\*|`", "", text or "")
    text = re.sub(r"\[_|_\]", " ", text)
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)          # TeaOfTheHolyOne -> Tea Of The Holy One
    text = text.replace("_", " ").replace("’", "'").replace("‘", "'")
    return [w[:-2] if w.endswith("'s") else w for w in _WORD.findall(text.lower())]


def _strip_list_marker(line: str) -> str:
    return re.sub(r"^\s*(?:[-*]|\d+[.)])\s+", "", line)


def _canonical_prose(text: str) -> Tuple[List[str], List[Tuple[int, int]]]:
    """Returns the canonical prose as one word list plus (start, end) word ranges of its sentences."""
    lines = []
    for raw in (text or "").splitlines():
        line = _BORDER.sub(" ", raw).strip()                     # NOTE underlines share a line with text
        if not line or "|" in line:
            continue
        lines.append(_XREF.sub("", re.sub(r"^NOTE\s+", "", line)))
    prose = " ".join(lines)
    words: List[str] = []
    sentences: List[Tuple[int, int]] = []
    for sent in re.split(r"(?<!Mr\.)(?<!Dr\.)(?<!Mrs\.)(?<=[.!?])\s+", prose):
        toks = _tokens(sent)
        if toks:
            sentences.append((len(words), len(words) + len(toks)))
            words.extend(toks)
    return words, sentences


def _units(guide: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Step description lines (ordered) and note lines (order-free) with their bolded terms."""
    units = []
    for step in guide.get("steps", []):
        sid = step.get("id")
        for k, line in enumerate((step.get("description") or "").splitlines(), 1):
            if line.strip():
                units.append({"loc": f"steps[{sid}].description line {k}", "text": line, "ordered": True})
        for n, note in enumerate(step.get("notes", []) or []):
            if note.get("table") or note.get("preformatted"):
                continue                                          # caption of a copied table/art block
            for k, line in enumerate((note.get("text") or "").splitlines(), 1):
                if line.strip():
                    units.append({"loc": f"steps[{sid}].notes[{n}] line {k}", "text": line, "ordered": False})
        for n, ch in enumerate(step.get("choices", []) or []):
            units.append({"loc": f"steps[{sid}].choices[{n}]", "text": ch.get("option", ""), "ordered": False})
    for u in units:
        u["text"] = _XREF.sub("", u["text"])                     # scaffold-added **[W-2-07] Title** cross-refs
        u["words"] = _tokens(_strip_list_marker(u["text"]))
        u["bold"] = {w for span in re.findall(r"\*\*(.+?)\*\*", u["text"]) for w in _tokens(span)}
    return [u for u in units if len(u["words"]) >= 3]


def _squash(words: List[str], vocab: set) -> List[str]:
    """Joins runs that spell one source token (Tea of the Holy One -> teaoftheholyone)."""
    out, i = [], 0
    while i < len(words):
        for j in range(min(len(words), i + 6), i + 1, -1):
            if "".join(words[i:j]) in vocab:
                out.append("".join(words[i:j]))
                i = j
                break
        else:
            out.append(words[i])
            i += 1
    return out


def _unsquash(gen: List[str], src: List[str]) -> Tuple[List[str], List[str]]:
    """Drops gen runs that spell a squashed source tag (TEAOFTHEHOLYONE vs Tea of the Holy One)."""
    gen, src = list(gen), list(src)
    for t in list(src):
        for i in range(len(gen)):
            for j in range(i + 2, len(gen) + 1):
                if "".join(gen[i:j]) == t:
                    del gen[i:j]
                    src.remove(t)
                    break
            else:
                continue
            break
    return gen, src


def _locate(words: List[str], index: Dict[Tuple[str, ...], List[int]], cursor: int = 0) -> int:
    """Best canonical start offset by trigram voting; -1 when nothing matches.
    Among near-equal candidates (repeated source phrases) the first one at or after `cursor` wins."""
    votes: Dict[int, int] = {}
    for i in range(len(words) - 2):
        for pos in index.get(tuple(words[i:i + 3]), ()):
            votes[pos - i] = votes.get(pos - i, 0) + 1
    if not votes:
        return -1
    top = max(votes.values())
    good = sorted(o for o, v in votes.items() if v >= 0.8 * top)
    return next((o for o in good if o >= cursor), good[0])


def check_text_fidelity(canonical: Dict[str, Any], guide: Dict[str, Any],
                        merged_texts: List[str] = ()) -> List[Dict[str, str]]:
    """Findings with `kind` altered-high (a number/polarity word swapped), altered, order, omitted, unsupported.
    `merged_texts`: canonical text of sections merged into this one (qa-status MERGED), placed before it."""
    full_text = "\n".join(list(merged_texts) + [canonical.get("text", "")])
    canon, sentences = _canonical_prose(full_text)
    if not canon:
        return []
    index: Dict[Tuple[str, ...], List[int]] = {}
    for i in range(len(canon) - 2):
        index.setdefault(tuple(canon[i:i + 3]), []).append(i)

    findings: List[Dict[str, str]] = []
    covered = [False] * len(canon)
    ordered_hits: List[Tuple[int, Dict[str, Any]]] = []
    cursor = 0

    def add(kind: str, loc: str, src: str, gen: str, desc: str) -> None:
        findings.append({"kind": kind, "location": loc, "source": src, "generated": gen, "description": desc})

    vocab = set(canon)
    all_words = set(_tokens(full_text))                       # includes box/table lines

    for u in _units(guide):
        w = u["words"] = _squash(u["words"], vocab)
        u["bold"] = set(_squash(sorted(u["bold"]), vocab)) | u["bold"]
        from_table = any(t.isdigit() for t in w) and sum(t in all_words for t in w) / len(w) >= 0.8
        off = _locate(w, index, cursor)
        if off < 0 and from_table:
            continue                                              # row built from a source table/box
        if off < 0:
            if len(w) >= 6:
                add("unsupported", u["loc"], "(no matching source prose)", u["text"][:160],
                    "Line has no matching canonical prose (invented or heavily reworded?)")
            continue
        lo, hi = max(0, off - 8), min(len(canon), off + 2 * len(w) + 12)
        sm = SequenceMatcher(None, w, canon[lo:hi], autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size]
        if blocks:                                                # trim the window to the aligned span
            first, last = blocks[0], blocks[-1]
            lo, hi = lo + max(0, first.b - first.a - 1), lo + last.b + last.size + (len(w) - last.a - last.size) + 1
            sm = SequenceMatcher(None, w, canon[lo:hi], autojunk=False)
        window = canon[lo:hi]
        matched = sum(b.size for b in sm.get_matching_blocks())
        if matched / len(w) < 0.5:
            if len(w) >= 6 and not from_table:
                add("unsupported", u["loc"], " ".join(window[:30]), u["text"][:160],
                    f"Only {matched}/{len(w)} words match the closest canonical prose")
            continue
        for b in sm.get_matching_blocks():
            for j in range(b.b, b.b + b.size):
                covered[lo + j] = True
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag not in ("replace", "delete"):
                continue                                          # dropped canonical words are allowed tightening
            gen, src = _unsquash(w[i1:i2], window[j1:j2])
            at_edge = (i2 == len(w) and j2 == len(window)) or (i1 == 0 and j1 == 0)
            # a word moved within the line ("also you should" -> "you should also") is not a change
            flagged = {t for t in gen if t in SIGNIFICANT or t.isdigit() or t in u["bold"]} - set(window)
            if not at_edge:                                       # at an edge, src is just neighbouring prose
                flagged |= {t for t in src if t in SIGNIFICANT or t.isdigit()} - set(w)
            if flagged:
                swapped = (tag == "replace" and not at_edge
                           and any(t in SIGNIFICANT or t.isdigit() for t in set(gen) - set(window))
                           and any(t in SIGNIFICANT or t.isdigit() for t in set(src) - set(w)))
                add("altered-high" if swapped else "altered", u["loc"], " ".join(window[max(0, j1 - 4):j2 + 4]),
                    " ".join(w[max(0, i1 - 4):i2 + 4]),
                    f"Changed/added words vs. canonical: {sorted(flagged)}")
        if u["ordered"]:
            ordered_hits.append((lo + sm.get_matching_blocks()[0].b, u))
            cursor = ordered_hits[-1][0]

    for (prev_pos, prev), (pos, cur) in zip(ordered_hits, ordered_hits[1:]):
        if pos < prev_pos:
            add("order", cur["loc"], f"canonical word {pos} comes before word {prev_pos} ({prev['loc']})",
                cur["text"][:160], "Step line appears in a different order than in the canonical prose")

    if ordered_hits:
        start = min(p for p, _ in ordered_hits)
        end = max(p + len(u["words"]) for p, u in ordered_hits)
        for s, e in sentences:
            if e - s < 4 or s < start or e > end:
                continue
            if sum(covered[s:e]) / (e - s) < 0.34:
                add("omitted", "steps", " ".join(canon[s:e])[:160], "(not found in step text or notes)",
                    "Canonical prose sentence inside the walkthrough is not covered by any step line")
    return findings
