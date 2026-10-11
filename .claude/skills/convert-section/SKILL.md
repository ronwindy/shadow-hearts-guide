---
name: convert-section
description: >-
  Converts one canonical guide section (walkthrough, hub/teaser, or reference appendix) into a QA-passed structured section, covering the judgement calls the pipeline scripts cannot make. Use when asked to convert, structure or "do" a section by id (e.g. w-s-01), or to continue with the next chronological section.
---

# /convert-section <id>

Thin runbook for the parts that need judgement. Commands, schema and role boundaries live in `CLAUDE.md` §3-§5 and the `guide-transformer` / `qa` skills; do not duplicate them here. Source fidelity always wins: never add, rename or "fix" game facts.

## 1. Pick the path
- `a-*` / reference tables, items, shops, bestiary, bosses: deterministic scaffold, no prose editing, then `--verify`. Stop after step 4.
- `w-*` (including hubs `w-s-*`, `w-2-11`, `w-2-13`, `w-2-15`): the full path below.
- No id given: use `status.py --summary` (first 45 lines of `STATUS.md`); next = sequence gaps, then QA `[FAIL]`s, then pending QA, then next chronological.

## 2. Scaffold, then judge it
Run `pipeline.py <id> --scaffold`, then compare the draft with the canonical `text`.

- Canonical text: `canonical-sources/sections/<id>-<slug>.json`, field `text` (boss cards, parsed enemies and `bosses[]` sit in the same file). Do not search for it.
- Boss cards are matched to the canonical by `(type, name)`; same-name fights (e.g. Li Li as SUB-BOSS, then BOSS) are separate cards. A `bosses[].name` with a comma is normally ONE box with several enemy rows (`Hellcat, Hellcat`); keep that exact name so QA matches it. If a name joins two different fights, the canonical is stale: run `.\scripts\run-py.cmd .claude/skills/source-importer/scripts/import_gamefaqs.py --rederive` (add `--dry-run` first to list affected sections; see `source-importer`) instead of patching around it. Same for a boss card with `exp`/`cash` null or a strategy cut off mid-sentence while the canonical text has the full box: the canonical is stale (fix the importer, rederive), do not hand-patch the numbers.
- Boss `party[]` carries the box's `equipment[]` and `fusions[]` from the canonical; keep them (QA compares them, spaces/case ignored).
- Accented letters (`voilà`, `LàLà`) show as `�` in some consoles but are intact in the canonical (check the codepoint, not the display). A real U+FFFD in a draft is a source encoding defect: lint flags it as `mojibake` (info). Keep the source text, or repair by judgement and note it; never guess silently.

The scaffold is garbled (hand-patch it with `scripts/patch_section.py <id> <patch.json>`; arrays replace) when any of these hold:
- it printed `fragment` / `mixed-list` warnings, or a step starts lowercase or mid-sentence;
- words or sentences are missing or reordered against the canonical (QA will still PASS: it does not catch this);
- a step type is a guess (fallback `exploration`, or `battle` with no encounter). Teasers pointing to side-quest sections are `quest`;
- an `items_summary` item `location` is empty or disagrees with the canonical (enemy notes / text). Lint reports empty ones as `empty-location` (info); fill only from the source.

Scan the canonical `text` for non-prose art blocks the scaffold dropped (room maps, grids, diagrams; anything that is not a header, shop, enemy or boss box, a choice box, a NOTE or prose). Keep those whose layout is information as a step note with `preformatted` (verbatim, only a common left indent removed, plus a normal `text` caption; see `docs/structured-schema.md` 3.2). Leave decorative borders and legends already captured as tables.

The scaffold already bolds prev/next `[CODE] Title` cross-references from `navigation` and defaults to bullets (numbered only with a sequence cue), so do not re-do those by hand.

Patch from the canonical text only. Keep the source order, one fact per bullet, no changed names/numbers/conditions.

Patch file format: write it with the Write tool, wrapped as `{"guide": {...}}`. `steps` as an object keyed by step id merges per step (`null` removes one, an unknown id appends); `steps` as an array replaces ALL steps. Same for other id-keyed lists.

- Do not write patch files with PowerShell `Set-Content`/`Out-File -Encoding utf8` (Windows PowerShell 5.1 adds a BOM); use the Write tool. `patch_section.py` tolerates a BOM, but check its output says `Wrote ...` before going on.
- Run the patch on its own, then `--lint` / `--check`. Chaining them hides a failed patch: `--check` still passes on the unpatched scaffold.
- When you replace `steps` with a different number of steps, renumber the `(step N)` cites in `items_summary` locations. Lint reports a stale one as `step-ref`.
- Do the cross-reference and wording self-review before launching the QA subagent: any later edit changes the structured hash and forces a second subagent run.
- Note boxes: check that every table/box in the canonical text reached the draft (prize tables, side-by-side two-column tables, grids). The scaffold detects side-by-side tables (`| A | B |xx| A | B |`; emitted as one table, left half then right half) but QA does not notice a missing one. Check long bulleted notes and `ALICE's`-style possessives (they can come out as `alice'`) too.

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
4. Apply the subagent's cosmetic findings (e.g. a leftover `_WORD_` marker) before recording the verdict in step 3, so it is not stale: patch, re-run `--check`, then `--verdict`.
5. The verdict stores a hash of the structured file. If the file changes afterwards, `--check`/`--finalize` warn that the verdict is stale: re-run the subagent and re-record the verdict.

## 6. Finalize with one confirmation
Run `pipeline.py <id> --finalize` (stages exactly the section's files, never commits). It stages only the section's files: importer/script fixes and a rederived canonical made along the way stay unstaged. Run `git status --short` and tell the user which other modified files exist, so they can choose to include them. Show the user the staged list and the suggested message, ask once, and commit only on a yes. Do not push.
