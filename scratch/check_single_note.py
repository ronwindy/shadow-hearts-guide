import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for s in data["sections"]:
    for m in re.finditer(r'^[ \t]*(NOTE)\s{2,}([^\n]+)', s["text"], re.MULTILINE):
        # check if it matched the full pattern
        full_match = re.match(r'^[ \t]*NOTE[ \t]+([^\n]+)\n[ \t]*[¯\-]+', s["text"][m.start():], re.MULTILINE)
        if not full_match:
            print(f"Non-matching NOTE in {s['id']}:\n{s['text'][m.start():m.start()+200]}")
