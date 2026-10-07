with open(".claude/skills/guide-transformer/SKILL.md", "r", encoding="utf-8") as f:
    content = f.read()

target = """However, do not label something "missable" simply because it appears optional.

The source must support the warning.

---

## 12. Optional Content"""

replacement = """However, do not label something "missable" simply because it appears optional.

The source must support the warning.

### Structured Notes from Canonical Markers

Canonical sections provide pre-parsed `markers.notes` with character offsets, 1-indexed line numbers, and clean multi-line text bodies:
- **Battle Mechanics & Warnings:** Notes often explain critical mechanics (e.g., Judgment Ring timing, un-winnable battles, special enemy immunities).
- **Presentation:** Transform these directly into callouts, warning boxes, or tips positioned alongside the corresponding steps according to their `line` number or context.

---

## 12. Optional Content"""

if target in content:
    new_content = content.replace(target, replacement)
else:
    new_content = content.replace(target.replace("\n", "\r\n"), replacement.replace("\n", "\r\n"))

with open(".claude/skills/guide-transformer/SKILL.md", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated notes guidance in guide-transformer/SKILL.md successfully!")
