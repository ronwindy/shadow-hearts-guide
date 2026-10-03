import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

def extract_section_markers(text, overview_items=[]):
    overview_item_map = {re.sub(r'[^a-z0-9]', '', it.lower()): it for it in overview_items}
    inline_items = []
    item_pattern = re.compile(r'\[_([^\]\n_]+(?:_[^\]\n_]+)*)_\]')
    lines = text.splitlines(keepends=True)
    line_offsets = []
    curr = 0
    for l in lines:
        line_offsets.append(curr)
        curr += len(l)
    def get_line_num(char_idx):
        import bisect
        return bisect.bisect_right(line_offsets, char_idx)

    for m in item_pattern.finditer(text):
        raw_name = m.group(1).strip()
        start, end = m.start(), m.end()
        line_no = get_line_num(start)
        p_start = max(0, text.rfind("\n\n", 0, start))
        p_end = text.find("\n\n", end)
        if p_end == -1: p_end = len(text)
        para = " ".join(text[p_start:p_end].split())
        norm_key = re.sub(r'[^a-z0-9]', '', raw_name.lower())
        matched_overview = overview_item_map.get(norm_key)
        inline_items.append({
            "name": raw_name,
            "matched_overview_item": matched_overview,
            "line": line_no,
            "char_offset": [start, end],
            "context": para[:200]
        })
    return inline_items

unmatched = []
for s in data["sections"]:
    items = extract_section_markers(s["text"], s.get("items", []))
    for it in items:
        if not it["matched_overview_item"]:
            unmatched.append((s["id"], it["name"], it["context"]))

print(f"Total unmatched: {len(unmatched)}")
for sec_id, name, ctx in unmatched[:20]:
    print(f"[{sec_id}] {name} -> {ctx[:100]}")
