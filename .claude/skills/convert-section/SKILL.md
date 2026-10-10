---
name: convert-section
description: >-
  Converts one canonical guide section (walkthrough, hub/teaser, or reference appendix) into a QA-passed structured section, covering the judgement calls the pipeline scripts cannot make. Use when asked to convert, structure or "do" a section by id (e.g. w-s-01), or to continue with the next chronological section.
---

# /convert-section <id>

Thin runbook for the parts that need judgement. Commands, schema and role boundaries live in `CLAUDE.md` §3-§5 and the `guide-transformer` / `qa` skills; do not duplicate them here. Source fidelity always wins: never add, rename or "fix" game facts.

## 1. Pick the path
- `a-*` / reference tables, items, shops, bestiary, bosses: deterministic scaffold, no prose editing, then `--verify`. Stop after step 4.
- `w-*` (including hubs `w-s-*`, `w-2-00`, `w-2-11`, `w-2-13`, `w-2-15`): the full path below.
- No id given: use `status.py --summary` (first 45 lines of `STATUS.md`); next = sequence gaps, then QA `[FAIL]`s, then pending QA, then next chronological.

## 2. Scaffold, then judge it
Run `pipeline.py <id> --scaffold`, then compare the draft with the canonical `text`.

- Canonical text: `canonical-sources/sections/<id>-<slug>.json`, field `text` (boss cards, parsed enemies and `bosses[]` sit in the same file). Do not search for it.
- Boss cards are matched to the canonical by `(type, name)`; same-name fights (e.g. Li Li as SUB-BOSS, then BOSS) are separate cards. A `bosses[].name` with a comma is normally ONE box with several enemy rows (`Hellcat, Hellcat`); keep that exact name so QA matches it. If a name joins two different fights, the canonical is stale: run `import_gamefaqs.py --rederive` (see `source-importer`) instead of patching around it.
- Boss `party[]` carries the box's `equipment[]` and `fusions[]` from the canonical; keep them (QA compares them, spaces/case ignored).
- Accented letters (`voilà`, `LàLà`) show as `�` in some consoles but are intact in the canonical (check the codepoint, not the display). A real U+FFFD in a draft is a source encoding defect: lint flags it as `mojibake` (info). Keep the source text, or repair by judgement and note it; never guess silently.

The scaffold is garbled (hand-patch it with `scripts/patch_section.py <id> <patch.json>`; arrays replace) when any of these hold:
- it printed `fragment` / `mixed-list` warnings, or a step starts lowercase or mid-sentence;
- words or sentences are missing or reordered against the canonical (QA will still PASS: it does not catch this);
- a step type is a guess (fallback `exploration`, or `battle` with no encounter). Teasers pointing to side-quest sections are `quest`.

Patch from the canonical text only. Keep the source order, one fact per bullet, no changed names/numbers/conditions.

Patch file format: write it with the Write tool, wrapped as `{"guide": {...}}`. `steps` as an object keyed by step id merges per step (`null` removes one, an unknown id appends); `steps` as an array replaces ALL steps. Same for other id-keyed lists.

## 3. Conventions (what the scripts will not do for you)
- Source shouting becomes **bold normal case** (`**last opportunity**`), never UPPERCASE; lint's `upper-item` is not to be silenced.
- A `missable` / `warning` note only when the source states the warning; the inline bold sentence alone is also valid.
- Choice `outcome` only when the source states it; otherwise omit.
- Cross-references to other sections go in the step text (bold `[CODE] Title`) and `navigation`; there are no relationship fields.
- Contradictions or ambiguity in the source: preserve and flag, never resolve silently.

## 4. Verify
`pipeline.py <id> --lint`, then `pipeline.py <id> --check` (validate + QA + build + status). Fix `[FAIL]`s by patching the structured file, not by editing QA.

## 5. Independent QA (`w-*` only)
1. `pipeline.py <id> --qa-subagent-prompt` prints the exact prompt and draft path.
2. Launch a subagent with that prompt (it writes `qa-reports/<id>.subagent-draft.json` and must not run `--verdict`).
3. Read the verdict. On PASS (or only low findings you accept) run `pipeline.py <id> --verdict qa-reports/<id>.subagent-draft.json` (this deletes the draft). On FAIL/findings, patch the structured file and repeat from step 4.

## 6. Finalize with one confirmation
Run `pipeline.py <id> --finalize` (stages exactly the section's files, never commits). Show the user the staged list and the suggested message, ask once, and commit only on a yes. Do not push.
