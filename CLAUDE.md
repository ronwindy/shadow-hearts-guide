# Game Guide Converter — Agent Instructions

Converts game-guide source pages into polished static web pages (Astro, GitHub Pages). MVP scope: **one page in → one good page out**.

```text
Source → Canonical Source → Structured Guide JSON → Static Page → QA → GitHub Pages
```

## 1. Core Rule: Transform Presentation, Not Knowledge
The source is the sole authority for game facts. Priority when rules conflict: **source fidelity > user requirements > architecture > usability > visual polish > convenience.**

Allowed: restructure, reorder for readability (never where order carries gameplay meaning), tighten wording, make steps/checklists/tables, highlight warnings, add cross-references backed by project data.

Forbidden: inventing or guessing facts, adding outside/model knowledge, renaming items/characters/locations/enemies, changing numbers or requirements, silently resolving contradictions. If the source is ambiguous or contradictory, **preserve and flag it**. Extra research only if explicitly requested, and kept visibly separate.

## 2. Orientation & Status (do this first)
- Read the first 45 lines of [`STATUS.md`](STATUS.md) (or run `status.py --summary`) before starting. Never scan directories to orient yourself.
- After finishing work run `.\scripts\run-py.cmd scripts/status.py --update`.
- Next-section priority: fix sequence gaps → fix QA `[FAIL]`s → run pending QA → next chronological section.

## 3. Windows Runtime
- Python: always `.\scripts\run-py.cmd scripts/<script>.py ...` (resolves the interpreter across machines). **Run it from PowerShell**, not the Bash tool (the `.\` pattern hangs or fails there). For ad-hoc Python with quotes, write a temp script file instead of a heredoc.
- npm: `cmd /c npm run build`, `cmd /c npm test` (avoids PowerShell ExecutionPolicy errors).

## 4. Roles (logical agents = skills in `.claude/skills/`)
| Role | Skill | Owns | Must not |
| :-- | :-- | :-- | :-- |
| Source Importer | `source-importer` | canonical JSON (done for current source) | rewrite knowledge |
| Guide Transformer | `guide-transformer` | `structured-content/sections/*.json` | write Astro, add facts |
| Web Builder | `web-builder`, `frontend-expert` | `src/`, CSS, UX | change game facts |
| QA | `qa` | verification + `qa-status.json` | silently fix content |
| Code Reviewer | `code-reviewer` | code hygiene, [`TECH-DEBTS.md`](TECH-DEBTS.md) | refactor without staged human approval |

Make the smallest change that fulfils your role; hand other problems to the owning role.

## 5. Per-Section Workflow
Section types decide the path:
- **Walkthrough** (`w-*`): scaffold → LLM refine → validate → QA → independent QA subagent → status.
- **Reference/table appendices** (`a-*`, items, shops, bestiary, bosses): deterministic scaffold only, no LLM prose; validate → QA → status.

```powershell
.\scripts\run-py.cmd scripts/pipeline.py <id> --scaffold
.\scripts\run-py.cmd scripts/pipeline.py <id> --verify     # validate + QA report + status
```
Use `--check` (validate + QA + `npm run build` + status) per section; `--full` (adds frontend audit + code review) only after UI/code changes or about every 5 sections.

Choice outcomes: set `outcome` only when the source states it; otherwise omit (never infer). Boss data: all canonical bosses must be present in `bosses[]` or as `step.boss`; compare canonical boss count/names before editing.

## 6. Page Metadata
Every guide page has metadata (`id`, `title`, `type`, `source`, `related_pages`, `prerequisites`, `unlocks`). Relationship fields may be empty; never fill them speculatively.

## 7. UX Goal
Make the guide easier to follow *while playing*: objective, route, checklist steps, missable/important callouts, rewards, items, boss/encounter, optional content, each only when the source supports it.

## 8. Out of Scope for MVP
Whole-site crawling, multi-page auto-ingestion, vector DBs/RAG, knowledge graphs, backends, complex multi-agent orchestration, a general wiki generator. Don't build infrastructure for hypothetical needs; after ~5–10 converted pages, review real bottlenecks first.

## 9. Verification
Check your output against your role before calling it done. Central QA question: *did the presentation change while the source meaning stayed intact?*

## 10. User Role
The user selects sources, reviews, decides and publishes. Don't ask them to curate game knowledge.
