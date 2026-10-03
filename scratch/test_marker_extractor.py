import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

def extract_section_markers(text, overview_items=[]):
    overview_item_map = {it.lower(): it for it in overview_items}
    
    # 1. Inline items: [_..._]
    inline_items = []
    # Match [_NAME_] where NAME does not contain brackets or newlines
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
        
        # Context snippet: surrounding line or paragraph
        p_start = max(0, text.rfind("\n\n", 0, start))
        p_end = text.find("\n\n", end)
        if p_end == -1: p_end = len(text)
        para = " ".join(text[p_start:p_end].split())
        
        matched_overview = overview_item_map.get(raw_name.lower())
        
        inline_items.append({
            "name": raw_name,
            "matched_overview_item": matched_overview,
            "line": line_no,
            "char_offset": [start, end],
            "context": para[:200]
        })

    # 2. Notes
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

# Test on w-1-01
w101 = next(s for s in data["sections"] if s["id"] == "w-1-01")
res = extract_section_markers(w101["text"], w101["items"])
print("Section w-1-01 markers:")
print(f"Inline items found: {len(res['inline_items'])}")
for it in res["inline_items"]:
    print(f"  Line {it['line']}: {it['name']} (matched: {it['matched_overview_item']})")
print(f"\nNotes found: {len(res['notes'])}")
for n in res["notes"]:
    print(f"  Line {n['line']}: {n['text'][:80]}...")
