"""Bold important game terms (**term**) in the prose of structured sections.

Dictionary = names mined from the canonical appendices + scripts/term_extras.json
(manual statuses/locations/characters and a deny list). Only prose fields are touched
(step description, notes text, boss strategy, hub text); data fields keep exact names.

Usage:
  bold_terms.py --terms                 print the dictionary by category (review/prune)
  bold_terms.py <id> [--write]          dry-run / apply to one section
  bold_terms.py --all [--write]         every structured section
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANON = ROOT / "canonical-sources" / "sections"
STRUCT = ROOT / "structured-content" / "sections"
EXTRAS = Path(__file__).resolve().parent / "term_extras.json"

NAME = r"[A-Z][\w'’ .&-]*?"


def _canon_text(file_id: str) -> str:
    path = next(CANON.glob(f"{file_id}-*.json"))
    return json.loads(path.read_text(encoding="utf8"))["text"]


def _camel(name: str) -> str:
    """'TalismanOfLuck' -> 'Talisman of Luck' (same display rule as the scaffold)."""
    name = re.sub(r"(?<=\w's)(?=[A-Z])", " ", name)  # "Alchemist'sWater"
    if not re.fullmatch(r"[A-Z][a-z']+(?:[A-Z][a-z]+)+", name):
        return name
    words = re.findall(r"[A-Z][a-z']*", name)
    return " ".join(w.lower() if w in ("Of", "The") else w for w in words)


def mine_terms() -> dict[str, set[str]]:
    cats: dict[str, set[str]] = {}

    def add(cat: str, names):
        for n in names:
            n = _camel(n.strip())
            if len(n) >= 3 and re.search(r"[A-Za-z]", n):
                cats.setdefault(cat, set()).add(n)

    # skills/souls: "| 18 | Moon Howl | Earth |" rows and fusion headers "Raging Tiger (Earth, Level 1)"
    t = _canon_text("a-1-01")
    add("skills", re.findall(rf"^\|\s+(?:\d+|)\s*\|\s+({NAME})\s+\|", t, re.M))
    add("fusions", re.findall(r"^\|\s{2,3}(\S[^|]*?)\s+\(\w+, Level \d\)", t, re.M))
    # equipment tables: "|  Leather Gloves     |    0 /   0  |"
    for fid, cat in (("a-1-02", "weapons"), ("a-1-03", "armor"), ("a-1-04", "accessories")):
        add(cat, re.findall(rf"^\|\s{{2}}({NAME})\s+\|\s+[-\d]+ /", _canon_text(fid), re.M))
    # items / valuables: "|  Thera Leaf         |  Restores ..."
    for fid, cat in (("a-1-05", "items"), ("a-1-06", "valuables")):
        add(cat, re.findall(rf"^\|\s{{2}}({NAME})\s+\|\s{{2}}\S", _canon_text(fid), re.M))
    # bestiary / bosses / NPCs
    add("enemies", re.findall(rf"\|\s+No\.\s+\d+\s+\|\s+({NAME})\s+\|", _canon_text("a-1-13")))
    add("bosses", re.findall(rf"^\|\s({NAME})\s+\|\s+[\d,]+ HP\s+\|", _canon_text("a-1-14"), re.M))
    add("npcs", re.findall(rf"^\|\s+[\dA-Z-]+\s+\|\s+({NAME})\s+\|\s+\w+\s+\|", _canon_text("a-1-12"), re.M))
    # status abnormalities from the in-game help
    add("statuses", re.findall(r"Status Abnormality / ([A-Z][\w ]+?)\s*$", _canon_text("a-1-15"), re.M))
    # locations from walkthrough titles: "Shanghai, Huayuan (1)" -> Shanghai, Huayuan
    locs = set()
    for path in STRUCT.glob("w-[12]-*.json"):
        title = json.loads(path.read_text(encoding="utf8"))["guide"]["title"]
        locs |= {re.sub(r"\s*\(\d+\)$", "", p).strip() for p in title.split(",")}
    add("locations", locs - {"Asia Side Quests"})
    return cats


def load_extras() -> dict:
    return json.loads(EXTRAS.read_text(encoding="utf8")) if EXTRAS.exists() else {}


def build_dictionary() -> list[str]:
    cats = mine_terms()
    extras = load_extras()
    terms: set[str] = set()
    for names in cats.values():
        terms |= names
    for key, names in extras.items():
        if key not in ("deny", "_doc", "numbered"):
            terms |= set(names)
    terms -= set(extras.get("deny", []))
    return sorted(terms, key=lambda s: (-len(s), s))


def ambiguous_terms() -> set[str]:
    return set(load_extras().get("ambiguous", []))


# --- applying -------------------------------------------------------------------------

def _at_sentence_start(before: str) -> bool:
    tail = before.rstrip(" ")
    return (
        tail == ""
        or tail.endswith(("\n", ".", "!", "?", ":", '"', "•"))
        or re.search(r"(?:^|\n)\s*-$", tail) is not None
    )


def _compile(terms: list[str]) -> re.Pattern:
    numbered = set(load_extras().get("numbered", []))
    alts = "|".join(
        re.escape(t) + (r"(?: No\. \d+)?" if t in numbered else "") for t in terms
    )
    # case-sensitive; optional plural; not inside a word
    return re.compile(rf"(?<![\w*])({alts})(es|s)?(?![\w*])")


def _merge_spans(text: str, pat: re.Pattern) -> str:
    """'**London** Rats' -> '**London Rats**' when the joined words are one known term."""
    def repl(m):
        words = re.match(r"((?: [\w-]+){1,3})", m.group(2))
        for n in range(len(words.group(1).split(" ")) - 1, 0, -1) if words else ():
            tail = " ".join(words.group(1).split(" ")[: n + 1])
            full = pat.fullmatch(m.group(1) + tail)
            if full:
                return f"**{m.group(1)}{tail}**"
        return m.group(0)
    return re.sub(r"\*\*([^*]+)\*\*((?: [\w-]+){1,3})", repl, text)


def bold_text(text: str, pat: re.Pattern, ambiguous: set[str] | None = None) -> str:
    """Bold unmarked occurrences; leave existing **...** spans and `code` spans alone."""
    ambiguous = ambiguous if ambiguous is not None else ambiguous_terms()
    text = _merge_spans(text, pat)
    parts = re.split(r"(\*\*[^*]+\*\*|`[^`]*`)", text)
    done = ""
    for i, part in enumerate(parts):
        if i % 2 == 0:
            def repl(m, part=part, done=done):
                if m.group(1) in ambiguous and _at_sentence_start(done + part[: m.start()]):
                    return m.group(0)
                return f"**{m.group(1)}{m.group(2) or ''}**"
            part = pat.sub(repl, part)
        done += part
        parts[i] = part
    return "".join(parts)


def _walk_rich(node, pat):
    if isinstance(node, str):
        return bold_text(node, pat)
    if isinstance(node, list):
        return [_walk_rich(n, pat) for n in node]
    if isinstance(node, dict):
        out = dict(node)
        if "text" in out:
            out["text"] = _walk_rich(out["text"], pat)
        if "items" in out:
            out["items"] = _walk_rich(out["items"], pat)
        if "children" in out:
            out["children"] = _walk_rich(out["children"], pat)
        return out
    return node


def bold_section(guide: dict, pat: re.Pattern) -> dict:
    g = json.loads(json.dumps(guide))
    for step in g.get("steps", []):
        if isinstance(step.get("description"), str):
            step["description"] = bold_text(step["description"], pat)
        for note in step.get("notes") or []:
            note["text"] = _walk_rich(note.get("text"), pat)
        boss = step.get("boss")
        if boss and boss.get("strategy"):
            boss["strategy"] = _walk_rich(boss["strategy"], pat)
    for boss in g.get("bosses") or []:
        if boss.get("strategy"):
            boss["strategy"] = _walk_rich(boss["strategy"], pat)
    return g


def _diff_terms(old, new, found):
    if isinstance(old, str) and isinstance(new, str):
        a = set(re.findall(r"\*\*([^*]+)\*\*", old))
        for t in re.findall(r"\*\*([^*]+)\*\*", new):
            if t not in a:
                found.append(t)
    elif isinstance(old, dict) and isinstance(new, dict):
        for k in old:
            _diff_terms(old[k], new.get(k), found)
    elif isinstance(old, list) and isinstance(new, list):
        for o, n in zip(old, new):
            _diff_terms(o, n, found)


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf8")
    write = "--write" in argv
    args = [a for a in argv if not a.startswith("--")]
    if "--terms" in argv:
        for cat, names in sorted(mine_terms().items()):
            print(f"## {cat} ({len(names)})")
            print(", ".join(sorted(names)))
        print("## extras:", json.dumps(load_extras(), ensure_ascii=False))
        return 0
    pat = _compile(build_dictionary())
    files = sorted(STRUCT.glob("w-*.json")) if "--all" in argv else [
        next(STRUCT.glob(f"{args[0]}-*.json"))
    ]
    for path in files:
        found = bold_file(path, pat, write)
        print(f"{path.name}: +{len(found)} bolded -> {sorted(set(found))}")
    return 0


def bold_file(path: Path, pat: re.Pattern | None = None, write: bool = True) -> list[str]:
    """Bold terms in one structured file; returns the newly bolded terms (writes only when found)."""
    pat = pat or _compile(build_dictionary())
    data = json.loads(path.read_text(encoding="utf8"))
    new_guide = bold_section(data["guide"], pat)
    found: list[str] = []
    _diff_terms(data["guide"], new_guide, found)
    if write and found:
        data["guide"] = new_guide
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    return found


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
