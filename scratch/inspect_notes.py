import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Examine how NOTE blocks appear
notes = []
for s in data["sections"]:
    text = s["text"]
    # Look for NOTE followed by overline/underline or indentation
    # In w-1-01:
    #   NOTE     The Rude Hero comes equipped with...
    # ¯¯¯¯¯¯¯¯   [_COTTON SHIRT_]...
    pattern = re.compile(r'(^[ \t]*NOTE[ \t]+([^\n]+)\n[ \t]*[¯\-]+[ \t]*([^\n]*)\n((?:[ \t]{8,}[^\n]*\n*)*))', re.MULTILINE)
    for m in pattern.finditer(text):
        notes.append((s["id"], m.group(0), m.start(), m.end()))

print(f"Total structured NOTE blocks with pattern: {len(notes)}")
if notes:
    print("Sample NOTE from section:", notes[0][0])
    print(notes[0][1])

# Also check other callout types or general NOTE occurrences
all_notes = []
for s in data["sections"]:
    # Let's find any line starting with spaces then NOTE
    for m in re.finditer(r'^[ \t]*(NOTE)\s{2,}', s["text"], re.MULTILINE):
        all_notes.append((s["id"], m.start()))

print(f"Total lines starting with NOTE: {len(all_notes)}")
