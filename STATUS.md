# Shadow Hearts Guide Converter — Project Status

> **Last Synced:** `2026-10-04 20:51:16` | **Active Milestone:** Milestone 2: Asia Walkthrough Content Transformation

## 1. Quick Orientation (Agent Context)

```text
Canonical Import:   [########################] 100.0% (69/69)
Structured Content: [##----------------------] 10.1% (7/69)
QA Verified:        [##----------------------] 10.1% (7/69)
Web Pages Built:    [##----------------------] 10.1% (7/69)
```

### Next Priority Actions (Immediate Queue)
1. **[MEDIUM]** `Structure w-1-04 (Fengtian)` — *Next chronological section in the walkthrough sequence.*

---

## 2. Infrastructure & Skills Readiness

| Component | Status | Details |
| :--- | :---: | :--- |
| **Source Importer** | :white_check_mark: | READY (69 canonical sections imported) |
| **Guide Transformer** | :white_check_mark: | READY (schema, validator & scaffold available) |
| **QA Verifier** | :white_check_mark: | READY (verify_guide.py operational) |
| **Web Builder** | :white_check_mark: | READY (Astro static site operational) |
| **Frontend Expert** | :white_check_mark: | READY (3-section layout, UX review & audit script operational) |
| **GitHub Pages** | :white_check_mark: | READY (deploy.yml workflow configured) |

---

## 3. Category Progress Overview

| Category | Total | Canonical | Structured | QA Passed | Web Built | Progress |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Header** | 1 | 1 | 1 | 1 | 1 | `[############] 100.0%` |
| **Introduction** | 2 | 2 | 2 | 2 | 2 | `[############] 100.0%` |
| **Walkthrough - Asia** | 15 | 15 | 4 | 4 | 4 | `[###---------] 26.7%` |
| **Walkthrough - Europe** | 32 | 32 | 0 | 0 | 0 | `[------------] 0.0%` |
| **Appendices** | 16 | 16 | 0 | 0 | 0 | `[------------] 0.0%` |
| **Conclusion** | 3 | 3 | 0 | 0 | 0 | `[------------] 0.0%` |

---

## 4. Complete Section Matrix

### Header (1 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[HEADER]` | `header` | Title, Metadata & Intro Notes | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |

### Introduction (2 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[I-1-00]` | `i-1-00` | Table of Contents | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |
| `[I-1-01]` | `i-1-01` | Game Manual / Instructions | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |

### Walkthrough - Asia (15 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[W-1-00]` | `w-1-00` | Walkthrough - Asia | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |
| `[W-1-01]` | `w-1-01` | Trans-Siberian Express | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |
| `[W-1-02]` | `w-1-02` | Plains | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |
| `[W-1-03]` | `w-1-03` | Zhaoyang Village | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | Completed |
| `[W-1-04]` | `w-1-04` | Fengtian | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-04` |
| `[W-1-05]` | `w-1-05` | Dalian | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-05` |
| `[W-1-06]` | `w-1-06` | Smuggler's Boat | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-06` |
| `[W-1-07]` | `w-1-07` | Shanghai, Huayuan (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-07` |
| `[W-1-08]` | `w-1-08` | Temple Ruins | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-08` |
| `[W-1-09]` | `w-1-09` | Shanghai, Huayuan (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-09` |
| `[W-1-10]` | `w-1-10` | Asia Side Quests | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-10` |
| `[W-S-01]` | `w-s-01` | Yuri's Level 1 Fusions | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-01` |
| `[W-S-02]` | `w-s-02` | Kowloon Fortress | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-02` |
| `[W-S-03]` | `w-s-03` | Mr. Zhen's Pit Fight | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-03` |
| `[W-1-11]` | `w-1-11` | Shanghai, Kuihai Tower | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-1-11` |

### Walkthrough - Europe (32 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[W-2-00]` | `w-2-00` | Walkthrough - Europe | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-00` |
| `[W-2-01]` | `w-2-01` | Prague (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-01` |
| `[W-2-02]` | `w-2-02` | Bistritz (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-02` |
| `[W-2-03]` | `w-2-03` | Blue Castle (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-03` |
| `[W-2-04]` | `w-2-04` | Bistritz (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-04` |
| `[W-2-05]` | `w-2-05` | Blue Castle (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-05` |
| `[W-2-06]` | `w-2-06` | Prague (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-06` |
| `[W-2-07]` | `w-2-07` | Rouen | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-07` |
| `[W-2-08]` | `w-2-08` | London, Old Castle Street | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-08` |
| `[W-2-09]` | `w-2-09` | London, Orphanage | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-09` |
| `[W-2-10]` | `w-2-10` | Calios Mental Hospital (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-10` |
| `[W-2-11]` | `w-2-11` | Europe Side Quests, Part 1 | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-11` |
| `[W-S-04]` | `w-s-04` | Calios Mental Hospital (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-04` |
| `[W-S-05]` | `w-s-05` | Yuri's Gravestones | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-05` |
| `[W-2-12]` | `w-2-12` | Nemeton Monastery (1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-12` |
| `[W-2-13]` | `w-2-13` | Europe Side Quests, Part 2 | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-13` |
| `[W-S-06]` | `w-s-06` | Nemeton Monastery (Book of Rituals / Codex of Lurie) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-06` |
| `[W-S-07]` | `w-s-07` | The Orphanage (Emigre Manuscript / Lottery Member #3) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-07` |
| `[W-S-08]` | `w-s-08` | Rouen (Silent Peddler / Margarete's Armor, Weapon, & | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-08` |
| `[W-S-09]` | `w-s-09` | Blue Castle (Keith's Weapon / Lottery Member #1) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-09` |
| `[W-S-10]` | `w-s-10` | Prague (Rare Shop / The Dollhouse / Alice's Weapon) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-10` |
| `[W-S-11]` | `w-s-11` | Cave Temple (Keith's Armor / Zhuzhen's Weapon) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-11` |
| `[W-S-12]` | `w-s-12` | Ancient Ruins (Alice's Armor / Halley's Weapon) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-12` |
| `[W-S-13]` | `w-s-13` | Yuri's Level 2 & 3 Fusions, ???? Attacks | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-13` |
| `[W-S-14]` | `w-s-14` | Sharon's Pit Fight (Halley's Armor / Other Items | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-14` |
| `[W-S-15]` | `w-s-15` | The Good Ending (Defeating the Masks) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-15` |
| `[W-2-14]` | `w-2-14` | Nemeton Monastery (2) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-14` |
| `[W-2-15]` | `w-2-15` | Europe Side Quests, Part 3 | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-15` |
| `[W-S-16]` | `w-s-16` | Nemeton Monastery (The Seraphic Radiance / | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-s-16` |
| `[W-2-16]` | `w-2-16` | Final Preparations | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-16` |
| `[W-2-17]` | `w-2-17` | Neameeto | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-17` |
| `[W-2-18]` | `w-2-18` | New Game+ | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `w-2-18` |

### Appendices (16 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[A-1-00]` | `a-1-00` | Appendices | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-00` |
| `[A-1-01]` | `a-1-01` | Special Skills / Souls | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-01` |
| `[A-1-02]` | `a-1-02` | Weapons | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-02` |
| `[A-1-03]` | `a-1-03` | Armor | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-03` |
| `[A-1-04]` | `a-1-04` | Accessories | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-04` |
| `[A-1-05]` | `a-1-05` | Items | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-05` |
| `[A-1-06]` | `a-1-06` | Valuables | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-06` |
| `[A-1-07]` | `a-1-07` | Store/Shop List | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-07` |
| `[A-1-08]` | `a-1-08` | Acupuncturist Costs | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-08` |
| `[A-1-09]` | `a-1-09` | The Lottery | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-09` |
| `[A-1-10]` | `a-1-10` | Malice Rewards | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-10` |
| `[A-1-11]` | `a-1-11` | Pedometer Rewards | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-11` |
| `[A-1-12]` | `a-1-12` | NPC Library | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-12` |
| `[A-1-13]` | `a-1-13` | Monster Library (Bestiary) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-13` |
| `[A-1-14]` | `a-1-14` | Sub-bosses and Bosses | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-14` |
| `[A-1-15]` | `a-1-15` | Help (detailed, available in-game) | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `a-1-15` |

### Conclusion (3 sections)

| Code | ID | Section Title | Canon | Struct | QA | Web | Next Action |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `[C-1-01]` | `c-1-01` | Version History | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `c-1-01` |
| `[C-1-02]` | `c-1-02` | Thanks | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `c-1-02` |
| `[C-1-03]` | `c-1-03` | Copyright / Disclaimer / Credits | :white_check_mark: | :white_circle: | :white_circle: | :white_circle: | Transform `c-1-03` |

---

## 5. Developer & Agent Commands

- **View Compact Status (Terminal):** `python scripts/status.py --summary`
- **Update Status Dashboard:** `python scripts/status.py --update`
- **Validate Structured Guide:** `python .agents/skills/guide-transformer/scripts/validate_guide.py <file>`
- **Run QA Verification:** `python .agents/skills/qa/scripts/verify_guide.py <canonical_file> <structured_file> -r <report_out>`
