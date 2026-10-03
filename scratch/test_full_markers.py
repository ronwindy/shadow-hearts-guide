import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Same function
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

    notes = []
    note_pattern = re.compile(
        r'^[ \t]*NOTE[ \t]+([^\n]+)\n[ \t]*[¯\-]+[ \t]*([^\n]*)\n((?:[ \t]{2,}[^\n]*\n*)*)',
        re.MULTILINE
    )
    for m in note_pattern.finditer(text):
        start, end = m.start(), m.end()
        line_no = get_line_num(start)
        first_line = m.group(1).strip()
        second_line = m.group(2).strip()
        rest = m.group(3).strip()
        
        full_note_lines = [first_line]
        if second_line:
            full_note_lines.append(second_line)
        if rest:
            full_note_lines.extend([l.strip() for l in rest.splitlines() if l.strip()])
        note_body = " ".join(full_note_lines)
        
        notes.append({
            "type": "NOTE",
            "line": line_no,
            "char_offset": [start, end],
            "text": note_body
        })

    return {
        "inline_items": inline_items,
        "notes": notes
    }

total_inline = 0
total_matched = 0
total_notes = 0

for s in data["sections"]:
    res = extract_section_markers(s["text"], s.get("items", []))
    total_inline += len(res["inline_items"])
    total_matched += sum(1 for it in res["inline_items"] if it["matched_overview_item"])
    total_notes += len(res["notes"])

print(f"Total sections: {len(data['sections'])}")
print(f"Total inline item tags found: {total_inline}")
print(f"Total matching overview items: {total_matched} ({total_matched/total_inline*100:.1f}%)")
print(f"Total notes found: {total_notes}")
