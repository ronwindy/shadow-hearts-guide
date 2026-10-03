with open(".agents/skills/guide-transformer/SKILL.md", "r", encoding="utf-8") as f:
    content = f.read()

target = """unless the source explicitly says so.

---

## 14. Prerequisites and Conditions"""

replacement = """unless the source explicitly says so.

### Entity-to-Step Linking with Canonical Markers

When transforming canonical section files (`sections/*.json`), the Transformer should leverage the pre-parsed `markers.items`:
- Each entry in `markers.items` specifies:
  - `name`: Raw entity tag (e.g. `THERA LEAF`, `LOTTERY MEMBER NO. 15`, `500 CASH`).
  - `matched_overview_item`: Canonical name matched from overview (e.g. `Thera Leaf`).
  - `category`: Category (`items`, `equipment`, `valuables`, `souls`, `cash`, `lottery`).
  - `line`: 1-indexed line number in the source text.
  - `char_offset`: Exact start and end character offsets.
  - `context`: Surrounding paragraph context.
- **Direct Step Association:** Instead of searching or guessing which step awards an item, map each procedural step to the `markers.items` occurring within that step's line or offset range:
  ```yaml
  - step: "Examine the body in the aisle"
    reward: "Thera Leaf"
  - step: "Examine the body lying in the booth"
    reward: "Mana Leaf"
  ```
- **Conditional / Alternate Rewards:** Inline markers also capture rewards mentioned only in prose (e.g., choice branches like getting a Leather Belt on first try vs Thera Seed on second try). Always preserve these conditions in the transformed steps.

---

## 14. Prerequisites and Conditions"""

assert target in content or target.replace("\n", "\r\n") in content, "Target not found in content!"

if target in content:
    new_content = content.replace(target, replacement)
else:
    new_content = content.replace(target.replace("\n", "\r\n"), replacement.replace("\n", "\r\n"))

with open(".agents/skills/guide-transformer/SKILL.md", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated guide-transformer/SKILL.md successfully!")
