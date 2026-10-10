---
name: qa
description: >-
  Verifies that generated game guides remain faithful to the canonical and original source, checking content fidelity, terminology, numbers, conditions, warnings, and static site build integrity. Use this skill when reviewing, auditing, validating, or running QA checks on converted game guide pages and build outputs.
---

# QA Agent

## 1. Role & Mission

The QA Agent provides an independent verification layer to ensure the generated guide faithfully reflects the canonical source without factual distortion, omission, or hallucination.

```text
Canonical Source JSON
      ↕  [python scripts/pipeline.py <id> --qa]
Structured Guide JSON
      ↕  [python scripts/pipeline.py <id> --frontend]
Built Web Page & Layout
```

**Central Question:** *Did we improve the presentation without accidentally changing, losing, or inventing knowledge?*

---

## 2. Core Principle: Detect, Don't Silently Fix

QA verifies and reports issues. QA must **never** silently alter guide data or invent missing details.
When issues are detected:
1. Log severity, location, source text, and observed generated text.
2. Direct the finding to the appropriate owner (`Guide Transformer`, `Web Builder`, or `Source Importer`).
3. Re-verify after the owner completes the fix.

---

## 3. Unified Pipeline Execution

Automated QA verification is integrated into the project pipeline:

```powershell
# Run QA verification and record the result in qa-status.json (findings print to console):
python scripts/pipeline.py <section_id> --qa

# Run full verification (Schema Validation + QA Verification + Status Sync):
python scripts/pipeline.py <section_id> --verify

# Audit all converted sections missing QA reports:
python scripts/pipeline.py --backlog

# Run frontend responsiveness and layout audits:
python scripts/pipeline.py <section_id> --frontend
```

---

## 4. Verification Checkpoints

### 4.1 Content Fidelity (Priority 1)
- **Overview Items & Inline Loot:** All overview items (`items`, `equipment`, `valuables`, `lottery`, `souls`) exist in `items_summary` and are awarded in steps with exact names.
- **Allowed name normalization:** Re-spacing a source token that is only run together (`TeaOfTheHealer` -> `Tea of the Healer`, done by the scaffold's `space_camel_case`) is presentation, not a rename. Do not flag it; flag any change of letters, words or numbers.
- **Save Points & Choices:** Every canonical `overview.save_points` entry is in `guide.save_points`; every dialogue option is in `choices[]` (grouped by `prompt`, with `required` where the source marks the answer).
- **Enemies & Numbers:** Monster IDs, names, HP values, affinities, and drops match canonical tables verbatim.
- **Boss Stats & Chronology:** Boss cards match source stats and strategies. Boss battles must appear inside their chronological walkthrough steps—never hoisted into introductory overviews.
- **Shops & Economy:** Inventory item names, prices, and discounts match source data.
- **Warnings & Missables:** Critical alerts, missable flags, and failure conditions are preserved with appropriate callout styling.

### 4.2 Structural & Anti-Spoiler Checks
- Chronological narrative order is strictly preserved.
- Overviews contain objectives, routes, and item checklists, but **no tactical or story spoilers**.
- No duplicated strategy text between overview cards and step descriptions.
- Long prose (3+ sentences / ~40+ words) is formatted as a list; numbered only where order matters. List-splitting must not change names, numbers, conditions, or meaningful order (flag as `low` if a dense paragraph remains).

### 4.3 Technical & Frontend Quality
- Astro templates build cleanly (`npm run build`).
- No viewport overflow on mobile devices (`overflow-x-auto` around all tables).
- Navigation controls wrap gracefully (`flex-col sm:flex-row`).
- Internal pipeline IDs (`[W-1-01]`, `step_01_id`) are cleanly sanitized from user-facing headings.

---

## 5. Severity Classification

- **Critical:** Game-breaking or unbuildable errors. Invented game facts, wrong progression paths, site build failures.
- **High:** Misleading information. Wrong item names, incorrect numerical values, lost missable warnings, missing steps.
- **Medium:** Usability issues. Minor misaligned links, awkward responsive wrapping, terminology inconsistencies.
- **Low:** Cosmetic issues. Whitespace, minor formatting nuances.

---

## 6. Acceptance Criteria (Definition of Done)

A guide section is QA-approved when:
- [ ] Schema validation passes with 0 errors.
- [ ] Source fidelity audit reports **0 Critical** and **0 High** findings.
- [ ] QA result in `qa-status.json` is `PASS` (re-run after any edit to the structured file).
- [ ] Root `STATUS.md` is synchronized via `python scripts/pipeline.py <section_id> --verify`.

---

## 7. Independent QA Subagent (walkthrough sections)

The transformer must not grade its own work. After `--verify` passes, launch a fresh-context, **read-only** subagent (Agent tool, `general-purpose`; do not pass your refine reasoning) with this brief:

> You are an independent QA reviewer for a game-guide conversion. Read only these two files: the canonical source `canonical-sources/sections/<file>.json` (`text` field is authoritative) and the structured guide `structured-content/sections/<file>.json`. Do NOT edit any file. Report findings only, as ONE JSON object and nothing else, matching `.claude/skills/qa/schemas/qa-verdict.schema.json`: `{"section_id", "verdict": "PASS"|"PASS_WITH_NOTES"|"FAIL", "spot_checked": [..], "findings": [{"severity", "category": invented|altered|omitted|order|contradiction|other, "location", "canonical", "structured", "issue"}]}`. Check for: (1) any fact, number, name, item, location or condition in the structured guide that is NOT in the canonical text (invented); (2) any name or number that differs from canonical (altered); (3) canonical steps, warnings, missables, choices or rewards missing from the structured guide (omitted); (4) step order that differs where order matters; (5) source contradictions that were silently resolved. Severity: critical/high/medium/low per the QA skill. If nothing is wrong, return `"verdict": "PASS"`, `"findings": []` and list what you spot-checked. Use `FAIL` if any finding is critical/high, `PASS_WITH_NOTES` for medium/low only.

Handling results: the Guide Transformer fixes critical/high findings and re-runs `--verify`; ambiguous source text is preserved and flagged, never "fixed". Save the JSON to a file and run `pipeline.py <id> --verdict <file.json>`: it validates the schema, stores it as `qa-reports/<id>.subagent.json` and fails on `FAIL`.
Skip this step for `reference` sections (the deterministic byte-for-byte check is sufficient).
