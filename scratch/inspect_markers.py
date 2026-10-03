import json
import re
from collections import Counter

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

text = "".join(s["text"] for s in data["sections"])

# Find patterns like [_..._]
inline_items = re.findall(r"\[_([^_]+)_\]", text)
print(f"Total inline item markers [_..._]: {len(inline_items)}, Unique: {len(set(inline_items))}")
print("Sample items:", list(set(inline_items))[:15])

# What about other bracketed patterns in walkthrough sections?
for s in data["sections"]:
    if s["category"].startswith("Walkthrough"):
        # find callouts like NOTE
        notes = re.findall(r'(\n\s{2}([A-Z]{3,10})\s{4,}[^\n]+\n\s*[¯\-]{4,}[^\n]*\n(?:[^\n]+\n)*)', s["text"])
        # print first 2 notes
        if notes and s["id"] == "w-1-01":
            print("Found notes in w-1-01:", len(notes))

callouts = re.findall(r'\n\s{1,4}([A-Z]{3,10})\s{3,}\S', text)
print("Potential callout words:", Counter([c for c in callouts if c in ["NOTE", "WARNING", "TIP", "IMPORTANT", "CAUTION", "ALICE", "YURI"]]))

# Check NOTE blocks specifically
note_blocks = re.findall(r'((\n\s*NOTE\s{3,}[^\n]+(?:\n[¯\-]{4,}[^\n]*)?(?:\n\s{4,}[^\n]+)*))', text)
print("Total NOTE blocks found:", len(note_blocks))
if note_blocks:
    print("Sample NOTE block:\n", repr(note_blocks[0][0][:200]))

# Check what other inline tags exist:
bracket_tags = Counter(re.findall(r'\[([^\]\n]{1,30})\]', text))
print("Top bracket patterns:")
for k, v in bracket_tags.most_common(20):
    print(f"  [{k}]: {v}")
