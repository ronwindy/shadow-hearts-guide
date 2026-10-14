---
name: guide-transformer
description: >-
  Transforms a canonical source guide artifact into structured, player-friendly guide content (objectives, routes, ordered step checklists, missable warnings, items, and rewards) while preserving factual meaning and game terminology. Use this skill when structuring, reorganizing, or preparing raw game guide content for static site presentation.
---

# Guide Transformer

Owns `structured-content/sections/*.json`. The working procedure and conventions live in the `convert-section` skill; this file holds the invariants only.

- **Transform presentation, not knowledge.** Everything stays grounded in the canonical source (`canonical-sources/sections/*.json`).
- **Allowed:** group narrative into chronological steps; extract objectives, routes and checklists; categorize notes (`tip` / `warning` / `tutorial`); link markers to steps; highlight entities; place boss battles in the step where they occur; turn dense prose into lists.
- **List rule:** prose with 3+ sentences or ~40+ words becomes a markdown list (numbered only when order matters); one fact per item; never alter names, numbers, conditions or order that carries gameplay meaning. Do not list-ify short prose, table cells or plain-string fields.
- **Forbidden:** inventing facts or outside knowledge; silently resolving source contradictions or errors; renaming characters, items, enemies, locations, mechanics; altering numbers; hoisting spoilers into headers.
- **Choices:** `choices[].option` verbatim; set `outcome` only when the source states it.
- **Source shouting** becomes bold normal case, never UPPERCASE.
- Step `type` is one of: `story`, `exploration`, `battle`, `boss`, `loot`, `puzzle`, `shop`, `dialogue`, `navigation`, `quest`, `preparation`, `misc`.
- Reference/appendix sections (`a-*`): scaffold in reference mode, no refinement; run `node scripts/guide.mjs check <id>` and stop.

Schema: `docs/structured-schema.md`. Format example: [example-walkthrough.json](references/example-walkthrough.json).
