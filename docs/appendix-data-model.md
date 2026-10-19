# Appendix Data Model

Decided in a grill-me interview on 2026-10-19. **Partly implemented (2026-10-19), see Progress at the end.** Covers the appendix pages `a-1-01` to `a-1-15` (`a-1-00` is the index and stays as it is).

## Why

The appendices use four JSON shapes and six near-duplicate parsers. The scaffold and QA each hard-code the page list by id. Two built pages are stale. This doc fixes one shape and one code path.

## Current state (2026-10-19)

| Page | Structured today | Notes |
| :-- | :-- | :-- |
| a-1-01 Special Skills / Souls | `reference_groups` (6 groups, Yuri has 20 cards) | Own renderer `ReferenceGroups.astro` |
| a-1-02 Weapons | `reference_tables` (6, one per character) | `description` as `detail_menu` + `detail` |
| a-1-03 Armor, a-1-04 Accessories | `reference_tables` (1 each) | Same box layout as weapons, no title |
| a-1-05 Items | `reference_tables` (1) | No `detail_menu` |
| a-1-06 Valuables | `reference_tables` (1) | Icon set `valuables` |
| a-1-07 Store/Shop List | `shops` (18) **and** `reference_tables` (18) | Rendered twice (`[id].astro` lines 152 and 159) |
| a-1-08 Acupuncturist Costs | `reference_blocks` (preformatted) | Stale: the parser now yields 6 tables |
| a-1-09 The Lottery | `reference_blocks` (preformatted) | Stale: the parser now yields 17 tables |
| a-1-10 Malice Rewards | `reference_tables` (1) | |
| a-1-11 Pedometer Rewards | not built | Canonical `shops` drops the Leather Suit row |
| a-1-12 NPC Library | not built | 34 entries: No., name, class, description |
| a-1-13 Monster Library | not built | 124 monsters, each with a formation sub-table (EXP, Cash, drops) |
| a-1-14 Sub-bosses and Bosses | not built | 43 boss records, already in boss-card shape in canonical |
| a-1-15 Help | not built | Prose: 6 HELP sections, about 100 underlined subheads |

Other findings:
- Reference pages never render `guide.bosses`. Only the step checklist uses it, so a-1-14 needs a render path.
- `parseItemBoxes`, `parseWeaponTables` and `parseGearTable` are near-identical loops. Three modules hold the parsers.

## Decisions

1. **One table model** for every record page (a-1-01 to a-1-14). The help page (a-1-15) uses the existing `blocks` shape, one block per HELP section.
2. **Row shape:** `{ cells[], description?, children? }`. `children` is a list of nested tables.
3. **Description object:** `description = { menu?, title?, text? }`. Each part is optional. It replaces `detail_menu`, `detail_title` and `detail`. The page still shows the Menu and Info labels.
4. **Rendering rule (default, not asked):** a row with `children` shows as a card. A row without `children` shows as a table row. Yuri's fusions and the monster entries use this.
5. **Shops:** each shop is one titled table, `"Location: Shop"`, with Item and Price columns. Appendix pages stop using the `shops` field. Walkthrough pages are unchanged. Qualifiers stay verbatim in the cell, so the price reads `"10000 (automatic)"`.
6. **Bosses (a-1-14):** reuse the existing boss-card shape and `BossCard`. This is the one exception to the table model. Reference pages get a render path for `bosses`.
7. **Field names:** `reference_tables` is the only table field. `reference_groups` and `reference_blocks` are retired.
8. **Code:** one module holds every appendix parser and one id-to-parser dispatch table. The scaffold and QA both use it. Shared helpers cover the box rules, the Menu / Info lines and cell splitting.
9. **Source authority:** parsers read the canonical **text**. QA compares the canonical `shops` and `bosses` fields and reports any gap. Canonical files are not edited without the user's say-so.
10. **Migration:** re-scaffold a-1-01 to 10 into the new shape and re-run QA, then build a-1-11 to 15 on the same shape.

## Target shape

```json
"reference_tables": [
  {
    "title": "Zhaoyang Village: Wandering Merchant",
    "columns": ["Item", "Price"],
    "rows": [
      { "cells": ["Bandanna", "320"] }
    ]
  }
]
```

A weapon row, from a-1-02 Leather Gloves:

```json
{
  "cells": ["Leather Gloves", "0 / 0", "1 / 1", "2 / 2", "3 / 3"],
  "description": {
    "menu": "Cow-hide with steel-plated knuckles.",
    "text": "Leather gloves for punching. Damages enemy while providing protection. Ideal for fighters."
  }
}
```

A nested row, illustrative only (exact cell split is for the implementation pass):

```json
{
  "cells": ["001", "Wind Shear", "10 HP", "Class: Wind"],
  "description": { "text": "Formed from the putrid vapors of a stagnant pond..." },
  "children": [
    {
      "columns": ["Enemy Formation", "EXP", "Cash", "Possible Item Drops"],
      "rows": [
        { "cells": ["Wind Shear x2 [1]", "4", "40", "Thera Leaf x2"] },
        { "cells": ["Wind Shear x2 [2]", "4", "0", ""] }
      ]
    }
  ]
}
```

Boss records (a-1-14) keep `bosses[]` in the walkthrough boss-card shape, rendered by `BossCard`.

Help (a-1-15) uses `blocks`, one block per HELP section, with each underlined subhead as a bold line in its text.

## Code plan

- **Parsers:** one module, `scripts/reference_appendix.mjs`, replaces `scripts/reference_tables.mjs` and `scripts/reference_skills.mjs`. It exports one dispatch table keyed by page id.
- **Scaffold:** [.claude/skills/guide-transformer/scripts/scaffold_structured_guide.mjs](../.claude/skills/guide-transformer/scripts/scaffold_structured_guide.mjs) lines 783 to 793 call the dispatch table, not an id chain.
- **QA:** [.claude/skills/qa/scripts/verify_guide.mjs](../.claude/skills/qa/scripts/verify_guide.mjs) lines 83 to 170 call the same dispatch and compare cell by cell.
- **Renderer:** `ReferenceTables.astro` gains `description` and `children`. `ReferenceGroups.astro` and `ReferenceBlocks.astro` are removed. Reference pages render `bosses` through `BossCard`. Appendix pages stop rendering `shops`.
- **Schema and types:** update [.claude/skills/guide-transformer/schemas/structured-guide.schema.json](../.claude/skills/guide-transformer/schemas/structured-guide.schema.json), [docs/structured-schema.md](structured-schema.md) (section 1 and the `reference_*` rows) and [src/lib/types.ts](../src/lib/types.ts).

## Migration order

1. Build the dispatch module. Prove parity for a-1-01 to 10: the new parser output, mapped to the new shape, must equal the current structured data. Check the diff before any re-scaffold.
2. Re-scaffold a-1-01 to 10. Run `check` on each, which includes the cell-level QA and the independent QA subagent verdict.
3. Confirm the a-1-07 double render is gone.
4. Build a-1-11 to 15 on the same shape, one at a time.
5. Run `node scripts/guide.mjs status --update`, then the build.

## Open items for the implementation pass

- Bestiary: where the "Locations: [1] Train ..." and "*Inflicts Poison" lines go, as child rows or as description text.
- a-1-12 NPC row layout: whether the class is a cell or part of the description.
- Yuri's card header: how the class, SP and summary map to cells and description.
- Canonical gap: the a-1-11 `shops` field lacks the Leather Suit row. Needs the user's decision before any canonical edit.

## Progress (2026-10-19)

Done:
- One parser module, `scripts/reference_appendix.mjs`, with one dispatch `parseReferenceTables(id, text)`. `scripts/reference_tables.mjs` is removed. The scaffold and QA both call it.
- Row shape `{ cells[], description? }` with `description = { menu?, title?, text? }` for a-1-02 to a-1-10. Parity with the old output checked for a-1-02, 03, 04, 05, 06, 07 and 10. The only change is the shape.
- a-1-07 no longer writes `shops`. QA checks each canonical shop against its `reference_tables` table.
- a-1-08 and a-1-09 are now parsed tables (they were stale `reference_blocks`).
- `ReferenceTables.astro`, the schema and `src/lib/types.ts` use the new row shape.
- a-1-02 to a-1-10 pass QA and the build.
- Leather Suit: added to the canonical a-1-11 `shops` field as `{name, price: "10000 (automatic)"}`, the price qualifier kept verbatim. Four-line canonical diff.
- a-1-11 Pedometer Rewards: one table, footer row included. Pass.
- a-1-12 NPC Library: one row per entry (No. | Name | Class), with the entry text as the row description. 34 entries. Pass.
- a-1-13 Monster Library: one row per monster (No. | Name | HP | Class), description = the description box plus the Locations / Inflicts lines, one `children` formation table per monster. 124 monsters, 179 formation rows; the 9 monsters without a formation table are handled. Pass.
- a-1-14 Sub-bosses and Bosses: the 43 canonical `bosses` records render through `BossCard` (new section on reference pages). Intro prose goes in `blocks`. Strategy text has its hard line breaks joined (presentation only). Pass.
- a-1-15 Help: one `blocks` entry per HELP section, underlined subheads as bold lines, bullet continuation lines joined. Pass.
- `ReferenceBlocks.astro` removed (no page uses it now). The scaffold still falls back to `reference_blocks` for an unparsed page.
- Word-level fidelity check on a-1-11..15: nothing lost. The only extra tokens are the column labels; the only missing ones are page titles and the singular/plural header, which is now fixed.
- QA gaps closed: dialogue-choice and walkthrough boss rules are gated to walkthrough pages; the reference boss check is exact JSON against canonical.
- Checked: all of a-1-02..a-1-15 pass QA (14/14), and `npm run build` succeeds.

Not done yet:
- a-1-01 still uses `reference_groups` and `reference_skills.mjs`. Needs the Yuri card mapping (open item above). `ReferenceGroups.astro` stays until then.
- Lint prose warnings (3+ sentences): a-1-14 has 47 (boss strategies), a-1-15 has 20 (Help). They are warnings, not failures. Splitting prose into bullets is a presentation call I did not make.
- Not checked in a browser; verified through the built HTML.
