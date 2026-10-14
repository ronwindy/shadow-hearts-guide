# Plan: port Python tooling to Node.js

Status: done (2026-10-14). Python removed; the CLI is `node scripts/guide.mjs <command>` (also `npm run guide -- <command>`).
Scope and decisions come from the grill-me session on 2026-10-14, revised after the user dropped the golden-output requirement.

## Outcome

- Scaffold output is identical to the Python for all 69 canonical sections (parsed JSON, key order included).
- QA reports and `qa-status.json` are identical to the committed Python results for every structured section.
- `bold` dry run matches the Python for all walkthroughs; term matching checked on sample strings (566 terms, same result).
- `check` gate passes on `w-1-02`, `a-1-05`, `w-s-01`, including `npm run build`.
- One intended behavior change: `bold` no longer drops words after a bolded term. The Python `**London** Rats are dangerous` became `**London Rats**. Beware` (text lost); the port keeps the remainder.
- `status` no longer reports a sequence gap when no walkthrough is structured yet (the Python `walk[:-1]` slice did).
- Pre-existing, not caused by the port: the stored subagent verdict for `w-1-02` no longer matches the structured file. Re-run the subagent (`qa-prompt`) and record it with `verdict`.

## Decisions

| Topic | Decision |
| :-- | :-- |
| Scope | All Python in the repo: `scripts/*.py` and the skill helpers they import (`validate_guide`, `lint_guide`, `verify_guide`, `text_fidelity`, `richtext`, `scaffold_structured_guide`). |
| Importer | `.claude/skills/source-importer/scripts/import_gamefaqs.py` is **deleted, not ported**. Git history keeps it. `SKILL.md` stays and describes a manual import. |
| Entry point | `scripts/run-py.cmd` is removed. Commands become `node scripts/guide.mjs ...`. |
| Schema validation | Ajv 2020 (`ajv/dist/2020`), reusing the existing schema file. Replaces `jsonschema`. |
| CLI | One Node entry point with consolidated subcommands (see below). `--verify` alias dropped. `--full` becomes a flag on `check`. |
| Verification | No golden-output comparison. The port is a rewrite, and small output drift from Python is accepted (personal project). Each module gets a smoke test: it runs, and its output is checked against the spec in the Python code. |
| Freeze | None. Section conversion is not blocked, since there is no parity gate. |
| Python removal | Python stays in the tree until the Node CLI passes the smoke tests, then it is deleted in one pass. |

## Current state

- Python: about 3,900 lines to port (the importer is excluded).
- Four working-tree files were committed separately as `bc4db97` before the port started: `DESIGN.md`, `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `tailwind.config.mjs`. The port must not touch them.

## CLI subcommands

Mapped from the current `pipeline.py` and `patch_section.py` / `status.py` flags.

| Subcommand | Replaces |
| :-- | :-- |
| `check <id...> [--full] [--no-build]` | `pipeline.py --check` / `--verify` / `--full` |
| `scaffold <id> [--force]` | `pipeline.py --scaffold`, `--force` |
| `validate <id>` | `pipeline.py --validate` |
| `lint [<id>]` | `pipeline.py --lint` (all sections when no id) |
| `qa <id>` | `pipeline.py --qa` |
| `qa-prompt <id>` | `pipeline.py --qa-subagent-prompt` |
| `verdict <id> <file\|->` | `pipeline.py --verdict` |
| `finalize <id>` | `pipeline.py --finalize` |
| `backlog` | `pipeline.py --backlog` |
| `frontend` | `pipeline.py --frontend` / `audit_frontend.py` |
| `patch <id> [patch.json\|-] [--rename OLD=NEW] [--dry-run] [--force]` | `patch_section.py` |
| `bold <id>` | `bold_terms.py` |
| `status [--update] [--json]` | `status.py` |

The final list is confirmed against the Python `--help` output while porting `pipeline.py`.

## Phases

### Phase 1: Node project setup

1. Add `ajv` as a dev dependency. Keep `package.json` and `npm run build` working.
2. Create `scripts/guide.mjs` as the CLI entry point, with subcommand stubs.
3. Layout: the CLI and shared libraries live in `scripts/`. Skill-owned helpers move to `.claude/skills/<skill>/scripts/*.mjs`.

Exit: `node scripts/guide.mjs --help` lists the subcommands.

### Phase 2: Port leaf modules

Order: `richtext` → `lint_guide` → `text_fidelity` → `validate_guide` (Ajv) → `bold_terms` → `status`.

Smoke test each module on one real section before moving on.

### Phase 3: Port composite modules

1. `verify_guide` (uses `richtext`, `text_fidelity`).
2. `scaffold_structured_guide` (1,311 lines, uses `richtext`). Largest port.
3. `patch_section` (uses validation).
4. `audit_frontend`.

### Phase 4: Pipeline and CLI

1. Port `pipeline.py` (609 lines) into `check` and the other subcommands.
2. Wire every subcommand to the ported modules.
3. Keep the side effects: `check` updates `STATUS.md`, `finalize` stages files, `verdict` removes the draft file.

### Phase 5: Smoke test and Python removal

1. Run `check` on one section of each type (walkthrough `w-*`, hub, reference `a-*`) and confirm it completes with the same pass/fail result as the Python pipeline on the same input.
2. Run `npm run build`.
3. Delete all Python files in the repo, `scripts/run-py.cmd`, and `__pycache__` directories.
4. Update references (found by grep for `run-py`, `.py`, `pipeline.py`):
   - `CLAUDE.md` (Windows Runtime section, per-section workflow commands)
   - `.claude/skills/qa/SKILL.md`
   - `.claude/skills/convert-section/SKILL.md`
   - `.claude/skills/web-builder/SKILL.md`
   - `.claude/skills/source-importer/SKILL.md` (manual procedure, no script)
   - `docs/structured-schema.md`
   - `.gitignore` (Python `__pycache__` entries)
5. Update `STATUS.md` through the new `status` command.

Exit: `grep -r "\.py\|run-py" --exclude-dir=node_modules` returns nothing relevant.

### Phase 6: Commit

Commit only the port files. Leave unrelated changes alone.

## Risks

- **Scaffold output drift:** `scaffold_structured_guide` is the largest port. Output may differ from Python in sort order, regex, or float formatting. Accepted for this personal project; no golden diff.
- **Ajv vs jsonschema:** error message wording will differ. Pass/fail must match.
- **Smoke tests only:** a bug that changes output without crashing will not be caught automatically. The `check` run on sample sections is the main safety net.

## Open items

- Confirm the `scripts/` vs `.claude/skills/*/scripts/` layout in Phase 1.
- Confirm the final subcommand list against the Python `--help` output in Phase 4.
