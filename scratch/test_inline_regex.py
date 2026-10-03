import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

text = "".join(s["text"] for s in data["sections"])

# Inline item pattern: [_NAME_]
# Must not contain closing bracket or newlines
inline_items = re.findall(r'\[_([^\]\n_]+(?:_[^\]\n_]+)*)_\]', text)
print(f"Properly bounded inline item tags: {len(inline_items)}, Unique: {len(set(inline_items))}")
items_counter = {}
for it in inline_items:
    items_counter[it] = items_counter.get(it, 0) + 1

# Sort by frequency
sorted_items = sorted(items_counter.items(), key=lambda x: x[1], reverse=True)
print("Top 20 inline items:")
for name, cnt in sorted_items[:20]:
    print(f"  {cnt:2d}x: {name}")

# Let's check sections and find where these inline items appear
section_item_counts = {}
for s in data["sections"]:
    matches = list(re.finditer(r'\[_([^\]\n_]+(?:_[^\]\n_]+)*)_\]', s["text"]))
    if matches:
        section_item_counts[s["id"]] = len(matches)

print("\nSections with inline items:", len(section_item_counts))
print("Sample section counts:", list(section_item_counts.items())[:10])
