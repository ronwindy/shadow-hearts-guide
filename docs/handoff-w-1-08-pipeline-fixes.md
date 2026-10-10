# Handoff: pipeline fixes found while converting w-1-08

Context: `w-1-08` (Temple Ruins) was converted end to end and committed as `ae0bfc9`. The scaffold got it about 60% of the way; the rest was hand work. Fix these so the next walkthrough section needs less. Reproduce against `w-1-08` by re-running `pipeline.py w-1-08 --scaffold` into a scratch copy and diffing against the committed structured file (committed file = the correct target).

## Run first (CLAUDE.md priority queue)
1. Fix QA FAIL in `header`.
2. Run QA on `i-1-00`.
3. Then `w-1-09`.

## A. Scaffold defects (`scripts/pipeline.py --scaffold`, scaffold logic)
| # | Defect | Expected behaviour |
| :-- | :-- | :-- |
| A1 | Source NOTE blocks that precede a paragraph are all appended to the last step (step 31 had 4 wrong notes: enemy-class, Clear Malice, Soul Energy, last-shop) | Attach each note to the step built from the paragraph that follows it in source order (use `markers.notes[].line`) |
| A2 | A NOTE that wraps and contains a second `NOTE` token was cut off; the tail became orphan step 16 ("any equipment on that you may need.") | Treat a second `NOTE` token inside a note as a new note; never emit a step from a note tail |
| A3 | Step `type` is wrong: 29 and 31 typed `battle` (story beats), 30 typed `exploration` (boss follows) | Prefer `story` for "after the battle / dialogue" text; `boss` for the step that leads into the boss card |
| A4 | Final boss lives only in `bosses[]` and `guide.boss`; QA-004 "not mapped to any walkthrough step" | Attach the boss card to the step whose text leads into the fight (`step.boss` + `encounter.enemies`) |
| A5 | CamelCase names (`TalismanOfMercy`, `TalismanOfLuck`, `TeaOfTheHealer`) survive in `items_summary`, `shops`, `rewards` | Apply the shared name normalizer from the 0fe231e commit to all three at scaffold time |
| A6 | `\|\|` ASCII-box artifact in Qinggu strategy; uppercase emphasis kept as tags | Strip box characters inside boss-card text; lowercase or bold emphasis |

## B. Tooling
| # | Item | Suggestion |
| :-- | :-- | :-- |
| B1 | `patch_section.py` replaces arrays wholesale, so renaming items meant re-emitting every `shops` inventory and each step's `rewards` | Add a "rename item everywhere" op, or merge arrays of dicts keyed by `name` |
| B2 | All step descriptions were hand-written | Deterministic first pass: split sentences into numbered list items, bold known item and character names; LLM step becomes review only |
| B3 | Boss strategy text exists in three places (`steps[].boss`, `guide.boss`, `guide.bosses[0]`) | Single source of truth; derive the others at build, or confirm which one the template renders and drop the rest |
| B4 | Verdict JSON had to be hand-copied from the subagent's reply into a file | Have the QA subagent write the verdict to a path, or let `pipeline.py --verdict` read stdin |

## C. Needs your decision
- **Boss loadouts:** `bosses[].party[]` keeps only name and level, so the source's recommended per-character equipment and fusion grid is dropped (QA verdict MEDIUM for w-1-08). Recurs on every boss card with the grid. Proposal: add optional `equipment[]` and `fusions[]` to `party[]` in `docs/structured-schema.md` and the JSON schema, then back-fill w-1-08 step 30, `guide.boss` and `bosses[0]`.
- **Open low notes on w-1-08:** objective "Proceed to Shanghai, Huayuan (2)" is derived from navigation, not source text; author asides ("Damn cat......") were dropped from steps 9 and 19.

## Suggested order
A1, A2, A4 (removed about half the manual work), then A3, A5, A6, then C (schema), then B.

## Done-when
Re-scaffolding w-1-08 yields a structured file whose notes, step types and boss placement already match `ae0bfc9`, and `pipeline.py w-1-08 --qa` shows no QA-004 style findings before any hand edits.
