# Technical Debt Register (TECH-DEBTS.md)

> **Repository:** Shadow Hearts Guide Converter  
> **Authority:** Code Reviewer Agent (`.claude/skills/code-reviewer/SKILL.md`)  
> **Last Updated:** 2026-10-08  
> **Status:** 6 Active Debts | 3 Resolved

This document serves as the single source of truth for technical debt, architectural smell, and deferred readability warnings identified during code reviews. 

When conducting reviews via the `/code-reviewer` skill, any findings that cannot be immediately addressed must be logged here. When debts are subsequently refactored and verified, they are transitioned to the [Resolved Technical Debts](#resolved-technical-debts) section.

---

## Debt Summary

| Metric | Count |
| :--- | :---: |
| **Total Active Debts** | 6 |
| **High Severity** | 0 |
| **Medium Severity** | 4 |
| **Low Severity** | 2 |
| **Resolved Debts** | 3 |

---

## Active Technical Debts

| ID | Category / Pillar | Target Location | Severity | Status | Date Added |
| :--- | :--- | :--- | :---: | :---: | :---: |
| [`TD-001`](#td-001) | Architectural Modularity | `.claude/skills/source-importer/scripts/import_gamefaqs.py` | Medium | `[ ] Open` | 2026-10-06 |
| [`TD-002`](#td-002) | Control Flow & Nesting | `.claude/skills/source-importer/scripts/import_gamefaqs.py:379` | Medium | `[ ] Open` | 2026-10-06 |
| [`TD-003`](#td-003) | Architectural Modularity | `.claude/skills/source-importer/scripts/import_gamefaqs.py:162, 273` | Low | `[ ] Open` | 2026-10-06 |
| [`TD-004`](#td-004) | Architectural Modularity | `.claude/skills/qa/scripts/verify_guide.py:29` | Medium | `[ ] Open` | 2026-10-06 |
| [`TD-005`](#td-005) | Architectural Modularity | `.claude/skills/guide-transformer/scripts/scaffold_structured_guide.py:141` | Medium | `[ ] Open` | 2026-10-06 |
| [`TD-006`](#td-006) | Architectural Modularity | `scripts/status.py` | Low | `[ ] Open` | 2026-10-06 |

---

### Detailed Active Debt Records

#### TD-001
- **Target File:** `.claude/skills/source-importer/scripts/import_gamefaqs.py`
- **Pillar:** Architectural Modularity & Scope
- **Severity:** Medium
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** The GameFAQs import script is 748 lines long, combining HTTP ingestion, raw text parsing, boss card extraction, regex marker handling, and JSON serialization in a single file.
- **Proposed Solution:** Split into modular sub-packages (e.g. `parser/bosses.py`, `parser/markers.py`, `importer/cli.py`).

#### TD-002
- **Target File:** `.claude/skills/source-importer/scripts/import_gamefaqs.py:379` (`import_gamefaqs_guide`)
- **Pillar:** Control Flow & Cognitive Load / Architectural Modularity
- **Severity:** Medium
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** `import_gamefaqs_guide` is 309 lines long with nested loops and branches reaching depths of 5 and 6 (lines 93, 95, 130, 222).
- **Proposed Solution:** Extract section-splitting, header parsing, and body extraction loops into dedicated helper functions with guard clauses.

#### TD-003
- **Target File:** `.claude/skills/source-importer/scripts/import_gamefaqs.py:162, 273`
- **Pillar:** Architectural Modularity
- **Severity:** Low
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** Functions `parse_boss_cards` (79 lines) and `parse_inline_markers` (89 lines) exceed the recommended 75-line limit.
- **Proposed Solution:** Decompose pattern matching and dictionary construction into smaller sub-helpers.

#### TD-004
- **Target File:** `.claude/skills/qa/scripts/verify_guide.py:29` (`verify_guide`)
- **Pillar:** Architectural Modularity
- **Severity:** Medium
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** `verify_guide` is 230 lines long, performing canonical checks, item count verifications, enemy validations, and markdown generation in one contiguous function.
- **Proposed Solution:** Decompose into distinct verification passes (`verify_items`, `verify_enemies`, `verify_steps`) and a separate formatter.

#### TD-005
- **Target File:** `.claude/skills/guide-transformer/scripts/scaffold_structured_guide.py:141` (`scaffold_guide`)
- **Pillar:** Architectural Modularity
- **Severity:** Medium
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** `scaffold_guide` spans 171 lines, handling regex extraction of objectives, steps, enemies, items, and schema framing.
- **Proposed Solution:** Extract pattern extractor functions into a helper module `extractors.py`.

#### TD-006
- **Target File:** `scripts/status.py`
- **Pillar:** Architectural Modularity & File Size
- **Severity:** Low
- **Status:** `[ ] Open`
- **Date Added:** 2026-10-06
- **Description:** `status.py` has grown to 482 lines. Functions `compute_project_status` (145 lines) and `generate_status_markdown` (111 lines) mix status calculation with Markdown rendering.
- **Proposed Solution:** Separate status metric computation from Markdown report rendering into dedicated modules.


---

## Resolved Technical Debts

| ID | Category | Target Location | Resolved Date | Resolution Notes |
| :--- | :--- | :--- | :---: | :--- |
| TD-007 | Modularity | `src/pages/guide/[id].astro` | 2026-10-08 | Extracted `Callouts`, `ObjectivesList`, `RouteProgression`, `InitialSetup`, `DocumentInfo`, `SectionHeading`; added `.card` class and `GuideContent` type; callout style map; URL helper. |
| TD-008 | Readability | `src/styles/global.css` | 2026-10-08 | Gold token via `theme()`, scoped transition, removed unused `.gothic-divider`, fixed stale comment. Checked-step selector coupling to `StepChecklist` kept and documented; `:focus-visible` not verified in browser. |
| TD-009 | UX | `src/pages/guide/[id].astro`, `guideData.ts` | 2026-10-08 | Steps now render (and list in page TOC) before items/enemies/shops/reference tables. |
