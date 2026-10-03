import json

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

raw = json.dumps(data, indent=2, ensure_ascii=False)
print("Current indent=2 size:", len(raw.encode("utf-8")), "bytes")

# Test 1: keep flat counts, but only non-zero
data1 = json.loads(json.dumps(data))
for s in data1["sections_index"]:
    for k in ["items_count", "inline_items_count", "enemies_count", "bosses_count", "notes_count", "shops_count"]:
        if s[k] == 0:
            del s[k]
raw1 = json.dumps(data1, indent=2, ensure_ascii=False)
print("Option 1 (omit zero counts):", len(raw1.encode("utf-8")), "bytes")

# Test 2: group into counts dict (all counts)
data2 = json.loads(json.dumps(data))
for s in data2["sections_index"]:
    c = {
        "items": s.pop("items_count"),
        "inline": s.pop("inline_items_count"),
        "enemies": s.pop("enemies_count"),
        "bosses": s.pop("bosses_count"),
        "notes": s.pop("notes_count"),
        "shops": s.pop("shops_count")
    }
    s["counts"] = c
raw2 = json.dumps(data2, indent=2, ensure_ascii=False)
print("Option 2 (counts dict):", len(raw2.encode("utf-8")), "bytes")

# Test 3: group into counts dict (non-zero only)
data3 = json.loads(json.dumps(data))
for s in data3["sections_index"]:
    c = {}
    for k, short in [("items_count", "items"), ("inline_items_count", "inline"), ("enemies_count", "enemies"), ("bosses_count", "bosses"), ("notes_count", "notes"), ("shops_count", "shops")]:
        val = s.pop(k)
        if val > 0:
            c[short] = val
    if c:
        s["counts"] = c
raw3 = json.dumps(data3, indent=2, ensure_ascii=False)
print("Option 3 (counts dict non-zero only):", len(raw3.encode("utf-8")), "bytes")
