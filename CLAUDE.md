# Game Guide Converter — Agent Instructions

Converts game-guide source pages into polished static web pages (Astro, GitHub Pages). MVP scope: **one page in → one good page out**.

```text
Source → Canonical Source → Structured Guide JSON → Static Page → QA → GitHub Pages
```

## 1. Core Rule: Transform Presentation, Not Knowledge
The source is the sole authority for game facts. Priority when rules conflict: **source fidelity > user requirements > architecture > usability > visual polish > convenience.**

Allowed: restructure, reorder for readability (never where order carries gameplay meaning), tighten wording, make steps/checklists/tables, highlight warnings, add cross-references backed by project data.

List rule: prose with 3+ sentences or ~40+ words becomes a bullet list (numbered only if order matters); one fact/action per item, no changes to names/numbers/conditions (details in `guide-transformer`).

Forbidden: inventing or guessing facts, adding outside/model knowledge, renaming items/characters/locations/enemies, changing numbers or requirements, silently resolving contradictions. If the source is ambiguous or contradictory, **preserve and flag it**. Extra research only if explicitly requested, and kept visibly separate.

## 2. Orientation & Status (do this first)
- Read the first 45 lines of [`STATUS.md`](STATUS.md) (or run `node scripts/guide.mjs status`) before starting. Never scan directories to orient yourself.
- `node scripts/guide.mjs check <id>` already updates `STATUS.md`; run `node scripts/guide.mjs status --update` only after work that did not go through `check`.
- Next-section priority: fix sequence gaps → fix QA `[FAIL]`s → run pending QA → next chronological section.

## 3. Windows Runtime
- Pipeline: `node scripts/guide.mjs <command>` (Node only, no Python). Ad-hoc JavaScript: write a temp `.mjs` file rather than a long inline `node -e`.
- npm: `cmd /c npm run build`, `cmd /c npm test` (avoids PowerShell ExecutionPolicy errors).

## 4. Roles (logical agents = skills in `.claude/skills/`)
| Role | Skill | Owns | Must not |
| :-- | :-- | :-- | :-- |
| Source Importer | `source-importer` | canonical JSON (done for current source) | rewrite knowledge |
| Guide Transformer | `guide-transformer` | `structured-content/sections/*.json` | write Astro, add facts |
| Web Builder | `web-builder` | `src/`, CSS, UX | change game facts |
| QA | `qa` | verification + `qa-status.json` | silently fix content |

Make the smallest change that fulfils your role; hand other problems to the owning role.

## 5. Per-Section Workflow
Section types decide the path:
- **Walkthrough** (`w-*`): scaffold → LLM refine → validate → QA → independent QA subagent → status.
  The independent QA subagent is a **manual step** (a script cannot spawn one): after `check` passes, run `node scripts/guide.mjs qa-prompt <id>` (prints the exact prompt and verdict path), launch a subagent with it, and act on its verdict. The subagent returns a JSON verdict (`.claude/skills/qa/schemas/qa-verdict.schema.json`); record it with `node scripts/guide.mjs verdict <id> <file.json>`. `check` runs bold terms, validate, lint, QA and build in that order (no ordering rules to remember; several ids build once, `--no-build` skips it). Standalone `node scripts/guide.mjs lint [<id>]` (no id = all sections) catches leftover prose blocks, UPPERCASE item tags, `[_TAG_]`, ASCII borders, and fragments (a step line starting lowercase = a wrapped source line split off). `scaffold` prints fragment / low-confidence step-type warnings: a flagged scaffold is a draft, compare it with the canonical and patch it before QA (QA does not catch garbled steps). The subagent writes `qa-reports/<id>.subagent-draft.json` and must not run `verdict`; `verdict` removes the draft. `node scripts/guide.mjs finalize <id>` stages exactly the section's files (no commit). `check` prints a reminder for `w-*` sections until `qa-reports/<id>.subagent.json` exists.
- **Reference/table appendices** (`a-*`, items, shops, bestiary, bosses): deterministic scaffold only, no LLM prose; validate → QA → status.

```bash
node scripts/guide.mjs scaffold <id>
node scripts/guide.mjs check <id>      # bold + validate + lint + QA + build + status
```
Use `check` per section; `check <id> --full` (adds frontend audit) only after UI/code changes or about every 5 sections.

Schema reference: [`docs/structured-schema.md`](docs/structured-schema.md). Edit structured files with `node scripts/guide.mjs patch <id> <patch.json>` (merge patch; re-validates; writes only if valid; write the patch with the Write tool, not a shell heredoc). Rename an item everywhere with `--rename OLD=NEW` (or `"$rename"` in the patch). `node scripts/guide.mjs verdict <id> -` reads the verdict JSON from stdin. `qa`/`check` print every finding and save the full report to `qa-reports/<id>.md`.

Choice outcomes: set `outcome` only when the source states it; otherwise omit (never infer). Boss data: all canonical bosses must be present in `bosses[]` or as `step.boss`; compare canonical boss count/names before editing.

## 6. Page Metadata
Every guide page has metadata: `id`, `title`, `type`, `source` and `navigation` (`prev` / `next`) — see [`docs/structured-schema.md`](docs/structured-schema.md). The schema has no `related_pages` / `prerequisites` / `unlocks` fields. Relationships the source states live in the step text (a hub teaser names the target as bold `[CODE] Title`) and in `navigation`; never add them speculatively.

## 7. UX Goal
Make the guide easier to follow *while playing*: objective, route, checklist steps, missable/important callouts, rewards, items, boss/encounter, optional content, each only when the source supports it.

## 8. Out of Scope for MVP
Whole-site crawling, multi-page auto-ingestion, vector DBs/RAG, knowledge graphs, backends, complex multi-agent orchestration, a general wiki generator. Don't build infrastructure for hypothetical needs; after ~5–10 converted pages, review real bottlenecks first.

## 9. Verification
Check your output against your role before calling it done. Central QA question: *did the presentation change while the source meaning stayed intact?*

## 10. User Role
The user selects sources, reviews, decides and publishes. Don't ask them to curate game knowledge.
