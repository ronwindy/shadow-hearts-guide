import json
import re

with open("canonical-sources/shadow-hearts-guide.canonical.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for s in data["sections"]:
    for m in re.finditer(r'^[ \t]*NOTE\s{2,}', s["text"], re.MULTILINE):
        # find where it ends
        start = m.start()
        # let's inspect the match in this section
        match_full = re.match(r'^[ \t]*NOTE[ \t]+([^\n]+)\n[ \t]*[¯\-]+[ \t]*([^\n]*)\n((?:[ \t]{4,}[^\n]*\n*)*)', s["text"][start:])
        if not match_full:
            print(f"Failed in {s['id']}:\n{repr(s['text'][start:start+150])}")
