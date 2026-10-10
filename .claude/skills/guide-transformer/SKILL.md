---
name: guide-transformer
description: >-
  Transforms a canonical source guide artifact into structured, player-friendly guide content (objectives, routes, ordered step checklists, missable warnings, items, and rewards) while preserving factual meaning and game terminology. Use this skill when structuring, reorganizing, or preparing raw game guide content for static site presentation.
---

# Guide Transformer Agent

## 1. Role & Pipeline Position

The Guide Transformer converts a **Canonical Source** (`canonical-sources/sections/*.json`) into structured, player-friendly guide representation (`structured-content/sections/*.json`).

```text
Canonical Source
      ↓
[CLI Scaffolding: scripts/pipeline.py <id> --scaffold]
      ↓
Guide Transformer Worker (Refine steps, highlight entities, map notes & rewards)
      ↓
Structured Guide JSON (Validated against structured-guide.schema.json)
```

**Core Mission:** Make the guide easier and more enjoyable to follow while playing, without changing, adding, or inventing any game knowledge.

---

## 2. Core Principle: Transform Presentation, Not Knowledge

Every piece of game knowledge must remain strictly grounded in the Canonical Source.

### Permitted Transformations:
- Grouping narrative into chronological, player-friendly steps.
- Extracting explicit objectives, routes, and checklists.
- Categorizing inline notes into `tip`, `warning`, or `tutorial`.
- Linking canonical item markers directly to the steps where they are found.
- Highlighting key gameplay entities (**bold** / `code`).
- Structuring boss battles chronologically within the steps where they occur.
- Converting long prose into lists (see **List Formatting Rule** below).

### List Formatting Rule (Long/Dense Text)
Any prose field (step description, note, overview, boss strategy) with **3+ sentences or ~40+ words** must be written as a markdown list, not a paragraph. The renderer (`src/lib/markup.ts`) already supports `- ` and `1. ` lines.
- **Numbered (`1. `)** only when order matters (sequential actions, routes, puzzle/dialogue sequences). **Bullets (`- `)** for parallel facts, tips, conditions, items, enemy lists.
- One action/fact per item. Split by sentence or clause; light tightening is allowed (trim filler), but never alter names, numbers, conditions, or any order that carries gameplay meaning.
- A short lead-in sentence may stay above the list. Keep warnings/missable flags as callouts, not buried in list items.
- Do not list-ify short prose (<3 sentences and <40 words), table cells, or fields whose schema expects a plain string.

### Strictly Forbidden:
- Inventing facts or inserting outside wiki/model knowledge.
- Correcting source errors or resolving source contradictions silently.
- Renaming characters, items, enemies, locations, or mechanics.
- Altering numerical values (HP, stats, prices, levels, drop rates).
- Hoisting late-game boss strategies or spoilers into section headers.

---

## 3. Workflow: Scaffolding-First Execution

**Choose the path by section type first:**
- **Reference/appendix sections** (`a-1-01` … `a-1-15`): the scaffold runs in *reference mode*. Canonical text is copied byte-for-byte into `reference_blocks` (type `reference`) with no steps and no LLM prose. Do **not** refine them; run `--verify` and stop. QA checks the text is identical to canonical.
- **Walkthrough/sidequest/intro sections**: follow the steps below.

Always leverage the deterministic Python scaffold before refining:

1. **Scaffold Draft on Disk (0 Tokens):**
   ```powershell
   .\scripts\run-py.cmd scripts/pipeline.py <section_id> --scaffold
   ```
   This pre-populates metadata, navigation, enemies, bosses, shops, and overview items summary.
2. **Refine Steps & Markers in Subagent:**
   Edit the generated JSON file in `structured-content/sections/` to:
   - Refine step descriptions for conciseness and gameplay clarity.
   - Apply **Entity Highlighting** (see Section 4).
   - **Before editing, compare the canonical boss count/names** (`canonical.bosses`) with the scaffold. Boss data lives in `bosses[]` (section level) or inline as `step.boss`; every canonical boss must appear with its full `type`, `enemies`, `party`, `exp`, `cash`, `strategy`. Sub-bosses found only in prose may sit on their step as `step.boss`.
   - Embed chronological boss battles directly inside their corresponding steps.
   - Ensure step `type` is one of the schema enum values (`story`, `exploration`, `battle`, `boss`, `loot`, `puzzle`, `shop`, `dialogue`, `navigation`, `quest`, `preparation`, `misc`).
   - Check reward mappings against `markers.items`.
3. **Validate & Verify:**
   ```powershell
   .\scripts\run-py.cmd scripts/pipeline.py <section_id> --check
   ```

*(Field-by-field reference: [docs/structured-schema.md](../../../docs/structured-schema.md). Patch edits with `scripts/patch_section.py <id> <patch.json>`. See [example-walkthrough.json](file:///d:/Games/GameGuides/shadow-hearts-guide/.claude/skills/guide-transformer/references/example-walkthrough.json) for the canonical structured format).*

---

## 4. Entity Highlighting Rules

To make steps instantly scannable during active gameplay, systematically emphasize key entities using Markdown bold (`**...**`) or inline code (`` `...` ``):

1. **Items, Equipment, Valuables & Souls**: `**Thera Leaf**`, `**Leather Gloves**`, `**Talisman**`, `**Death Emperor**`.
2. **Locations & Destinations**: `**World Map**`, `**Plains**`, `**Save Point**`, `**Graveyard**`.
3. **Mechanics & Classes**: `**Judgment Ring**`, `**Malice**`, `**Hit Area**`, `**Wind class**`.
4. **Enemies & NPCs**: `**Wind Shear**`, `**Roger Bacon**`, `**Master Li Zhuzhen**`.
5. **Controller Inputs**: `` `CROSS` `` or `**CROSS button**`.
6. **Source shouting** (`ONLY`, `LAST OPPORTUNITY`, `MAKE SURE TO SAVE`): keep the emphasis as bold in normal case (`**only**`, `**last opportunity**`), never UPPERCASE. `lint` flags UPPERCASE runs as item tags (`upper-item`) on purpose; the fix is the bold form, not a lint exemption.
7. **Hub teasers** (`[W-S-01] Title` + bullets): one step per teaser, `type: quest`, bold `[CODE] Title` as the first line, one sentence per bullet. Relationships between pages live here and in `navigation`, not in extra fields.

---

## 5. Note Categorization Heuristics

Map canonical narrative callouts and `markers.notes` to the structured `notes` array in steps or overview:

- **`warning`**: Missable items, permanent consequences, impossible/unwinnable battles, dangerous status effects, high-threat gimmicks.
- **`tutorial`**: Battle systems, Judgment Ring timing, Ring Soul upgrades, fusion mechanics, shopping/pawn mechanics.
- **`tip`**: Exploration advice, recommended party formations, general efficiency tips, save opportunities.

---

## 6. Item & Reward Association

- Match all step loot and rewards to `markers.items` and `overview.items`/`equipment`/`valuables`/`lottery`/`souls`.
- Provide `matched_overview_item` whenever an inline item corresponds to an overview checklist item.
- Retain conditional choices (e.g. choice A gives Item X, choice B gives Item Y).

### Choice paraphrase policy
- `choices[].option` is the source option text, verbatim.
- `choices[].outcome` is set **only** when the source states the result (e.g. "choose 2 to watch a series of events"). When the source gives just the option text, **omit `outcome`** — never infer or guess it (e.g. do not write "Stay in the Sewers" for "Wait a moment").
- QA flags options not found in the source and outcomes whose wording is not traceable to the source.

---

## 7. Standardized Reference Sub-Schemas

For pre-walkthrough or appendix sections (`i-1-01`, `a-1-01` through `a-1-15`), store structured entities under `guide.overview` adhering to definitions in `structured-guide.schema.json`:

- **Character Profiles (`#/$defs/character_profile`)**: `name`, `profile`, optional `age`, `class`.
- **Glossary Entries (`#/$defs/glossary_entry`)**: `term`, `description`.
- **Controller Mappings (`#/$defs/controller_mapping`)**: `button`, `function`.

---

## 8. Quality Checklist (Definition of Done)

Before completing transformation of any section:

- [ ] **100% Source Grounding:** No external facts, fabricated rewards, or invented tactics.
- [ ] **Exact Terminology:** All names and numbers match canonical source verbatim.
- [ ] **Chronological Boss Battles:** Boss encounters appear inside their matching step, not isolated at the top.
- [ ] **No Spoilers in Overviews:** Tactical spoilers are not hoisted into initial overviews.
- [ ] **Lists Over Walls of Text:** No prose block with 3+ sentences or ~40+ words remains a paragraph; use numbered lists only for ordered steps.
- [ ] **Entity Highlighting:** Key items, places, enemies, and mechanics are highlighted.
- [ ] **Schema Compliance:** Passes `python scripts/pipeline.py <id> --validate`.
- [ ] **QA Verification:** Passes `python scripts/pipeline.py <id> --qa` with 0 critical/high findings.
