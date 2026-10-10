# Handoff — backlog from handoff-2026-10-10-w-s-01 (2026-10-11)

Continues [handoff-2026-10-10-w-s-01.md](handoff-2026-10-10-w-s-01.md). Decisions were made in a grill-me session; do not re-ask.

## State
- `650c334` on `main` (not pushed): backlog items **1, 2, 3, 4, 7** done (pipeline/scripts commit).
- Still open: **5, 6, 8**. Do each as its own commit by owner; do not mix with `w-s-02` conversion commits.
- `docs/handoff-2026-10-10-w-s-01.md` and this file are untracked; commit them with the docs/runbook commit if wanted.
- Rollout decision: tools only; do not patch converted sections' content in this work (report findings only).

## Done (650c334) — behavior to know
- `lint_guide.py`: info rule `empty-location` (hint only, never fills).
- Scaffold: `battle` needs a known enemy in the text, else `exploration`; bullets unless a sequence cue (first/then/next/after that/finally); bold prev/next `[CODE] Title` from `navigation` (bare title only with a pointing cue); retype to `quest` only for `[W-S-*]` + "side quest".
- `--verdict` stores `structured_sha256`; `--check`/`--finalize` warn when stale (still stage). Existing verdicts (e.g. w-s-01) have no hash -> one-time NOTE until re-recorded.
- `patch_section.py <id> -` and `--verdict -` read stdin (BOM tolerant).

## Remaining work
| # | Owner | Decision |
| :-- | :-- | :-- |
| 5 | QA | **Stop reporting** "section heading location not in `route`" (low severity, side quests). Edit the QA subagent prompt (`pipeline.py --qa-subagent-prompt`, `run_qa_subagent_prompt` area, ~lines 335-360) and/or `.claude/skills/qa/` so a heading-only location absent from `route` is not a finding. No data change. |
| 6 | Web Builder (`web-builder`/`frontend-expert`) | Items table: when `location` is empty render **nothing** (no pin icon, no placeholder). Seen in "Obtainable Items & Treasures". Find the component under `src/` (grep for the pin icon / `location`); verify with `cmd /c npm run build` and a page with an empty location (e.g. w-1-04 "Lottery Member No. 15"). |
| 8 | Runbook | In the `convert-section` skill, section 2 "garbled when" list, add: check `items_summary` item locations against canonical (enemy notes / text). Also mention that scaffold now auto-bolds nav cross-refs and defaults to bullets, and the stale-verdict warning (re-run the subagent if the structured file changes after its verdict). |

## Checks after finishing
- `.\scripts\run-py.cmd scripts/pipeline.py --lint` (pre-existing warnings in header, w-1-04, w-1-05, w-1-06 are not from this work).
- `cmd /c npm run build` after item 6.
- Then continue with `convert-section` for `w-s-02` (Kowloon Fortress); use the manual checks in the older handoff only where tooling does not yet cover them (empty locations are now flagged as lint info).

## Gotchas
- PowerShell 5.1: `git commit -F -` does not work; write the message to a file and use `-F <file>`.
- Python edit scripts written via heredoc can turn `\b` / `\n` in strings into control characters; prefer the Edit tool, or `chr(92)` when scripting.
