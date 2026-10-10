# Handoff: pipeline fixes found while converting w-1-09

Context: `w-1-09` (Shanghai, Huayuan (2)) was converted end to end and committed as `390ae41`. Script QA passed with 0 findings, the independent subagent returned PASS_WITH_NOTES with 4 low notes (`qa-reports/w-1-09.subagent.json`). Several scaffold defects needed hand fixes. Reproduce with `pipeline.py w-1-09 --scaffold --force` into a scratch copy and diff against the committed structured file (committed file = correct target). Earlier related list: `docs/handoff-w-1-08-pipeline-fixes.md` (A5/B1/B4 there are already partly done; check before redoing).

## Next in queue (CLAUDE.md)
`w-1-10` (Asia Side Quests). Do the fixes below first if you want a cleaner scaffold.

## A. Scaffold defects (`scripts/pipeline.py --scaffold`)
| # | Defect seen in w-1-09 | Expected behaviour |
| :-- | :-- | :-- |
| A1 | ASCII divider lines (`¯ ¯ ¯ ...`, `_ _ _ ...`, `___`) became steps 4 and 8 (`"1. ¯ ¯ ¯"`) | Drop lines made only of box/divider characters; never emit a step from them |
| A2 | Single-line paragraphs get numbered (`"1. ..."`) and a "Meanwhile, in X..." line becomes its own step | Number only when 2+ items; fold short interstitial lines into the next step |
| A3 | Dialogue choice blocks: the `[1]` options and the prompt grouping were lost; only `[2]`/`[3]` kept; the `>` arrow marking the required answer was dropped | Parse the whole block: keep every option verbatim, group per prompt, record which is marked. Put the required answer in the step description |
| A4 | A `- ` list in the source (prizes) was joined into one line (`"- First win ... - Second win ..."`) | Preserve one list item per line |
| A5 | Step types guessed wrong (dog contest = `navigation`, dialogue lead-in = `exploration`) | Heuristics: "talk to / game / pay" -> `quest` or `misc`; "Meanwhile" cutscene -> `story`; keep `dialogue` when `choices` exist |
| A6 | `objectives` is derived from `navigation.next` ("Proceed to Asia Side Quests"), but the source offers a branch (W-1-11 Kuihai Tower or side quests) | Leave `objectives` empty unless the source states one; relationship fields are never filled speculatively (CLAUDE.md s.6) |
| A7 | Overview `save_points` ("Hotel ground floor") is not carried into the structured guide | Carry it through. Check whether the schema has a field for it (see section C) and whether earlier sections lost it too |
| A8 | "PLEASE pay attention" kept as an UPPERCASE emphasis word | Lowercase or bold per guide-transformer rules (I lowercased it by hand) |

## B. QA tooling
| # | Item | Suggestion |
| :-- | :-- | :-- |
| B1 | Script QA reported 0 findings while the subagent found 4 | Add deterministic checks: overview save points present, `objectives` text traceable to source, every canonical choice option present and grouped, item-name spelling vs source token |
| B2 | `--check` prints "[REMINDER] Independent QA subagent not run" even after `--verdict` stored `qa-reports/<id>.subagent.json` | Suppress the reminder when that file exists |
| B3 | `--check` already runs a status update; `status.py --update` afterwards is redundant noise | Drop it from the per-section workflow in CLAUDE.md s.2/s.5, or make `--check` the single entry point |
| B4 | Subagent step is hand-wired (prompt, verdict path, 8.3 temp path) | Add `pipeline.py <id> --qa-subagent-prompt` that prints the exact prompt and an output path |
| B5 | Renderer does not show `choices`, so the step description must repeat the choice | Render `choices` (grouped per prompt) in `src/`, or document that description is canonical |

## C. Needs your decision
- **Name normalization vs QA:** the scaffold respaces `TeaOfTheHealer` -> `Tea of the Healer` (intentional normalizer from commit 0fe231e), but the subagent flags it as a technical rename in every section. Decide: document it as an allowed normalization in `qa` skill rules, or keep source tokens.
- **Save points:** does `docs/structured-schema.md` have a home for `overview.save_points`? If not, add `guide.save_points: string[]` and back-fill the structured sections that dropped them (verify with a quick scan of canonical `overview.save_points` vs structured).
- **Open low notes on w-1-09:** (1) item spelling (above), (2) save point omitted, (3) objective, now patched by hand to "Continue with Kuihai Tower (W-1-11), or take on side quests", which is still paraphrase, not source wording, (4) flat 9-option choices list.

## Verification when done
- `pipeline.py w-1-09 --scaffold --force` into scratch has no divider steps, correct choices, empty/!derived objectives.
- `pipeline.py w-1-09 --check` and `cmd /c npm test` pass; re-run `--lint` on all sections.
