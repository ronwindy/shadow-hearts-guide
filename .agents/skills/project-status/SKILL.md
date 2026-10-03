---
name: project-status
description: >-
  Provides project-wide progress tracking, roadmap visibility, gap detection, and token-efficient status summaries across all 69 guide sections and pipeline stages. Use this skill when checking what is built, what needs to be built, what to build next, or when reporting project health.
---

# Project Status & Roadmap Agent

## 1. Role

The **Project Status** skill maintains live visibility across the entire guide conversion lifecycle.

It answers three core questions for both humans and agents:
1. **What is currently built?** (Which sections are canonical, structured, QA-verified, or web-built)
2. **What needs to be built?** (What sections remain unstarted, have pending QA, or have defect findings)
3. **What should be built next?** (The exact ranked priority queue of next actions)

It sits alongside the pipeline stages:

```text
Source Importer -> Canonical Source
       ↓
Guide Transformer -> Structured Guide
       ↓
QA Verifier -> QA Reports
       ↓
Web Builder -> Static Pages
       ↕
[Project Status Tracker]  <-- Audits all stages & maintains STATUS.md
```

---

## 2. Core Principles

### A. Grounded in Disk State
Status metrics are never guessed or manually hallucinated. They are computed directly from the filesystem by inspecting:
- `canonical-sources/shadow-hearts-guide.canonical.json` (canonical manifest)
- `canonical-sources/sections/*.json` (canonical section files)
- `structured-content/sections/*.json` (structured guide files)
- `qa-reports/*-qa-report.md` (QA verification reports and pass/fail states)
- `dist/` or `site/dist/` (compiled web pages)

### B. Token Economy for Agents
Agents should **never** run expensive directory scans (`dir canonical-sources/sections`, `dir structured-content/sections`, etc.) just to orient themselves.
Instead:
- Read lines 1 to 45 of `STATUS.md` (`view_file` on `STATUS.md`).
- Or run `python scripts/status.py --summary`.

This delivers complete orientation in < 350 tokens rather than burning 10,000+ tokens on exploratory queries.

### C. Deterministic Priority Resolution
When deciding what to work on next, follow this ranked order:
1. **Fix Sequence Gaps**: If section $N$ was structured but section $N-1$ was skipped, fill the gap first.
2. **Resolve QA Defects**: If a QA report flagged issues (`[FAIL]`), fix the structured guide.
3. **Complete Pending QA**: If a structured guide exists but lacks a QA report, run `verify_guide.py`.
4. **Advance Walkthrough Chronologically**: Structure the next sequential section in the active game region.
5. **Progress Infrastructure**: When content milestones reach stability, initialize/advance the Web Builder.

---

## 3. Tooling & Usage

The project provides an automated, zero-dependency Python script at `scripts/status.py`.

### Quick Commands

| Goal | Command | Description |
| :--- | :--- | :--- |
| **Terminal Dashboard** | `python scripts/status.py` | Full formatted ASCII dashboard with progress bars and categories |
| **Agent Context** | `python scripts/status.py --summary` | Ultra-compact (<20 lines) dense status text block |
| **Sync Status File** | `python scripts/status.py --update` | Recomputes metrics and writes `STATUS.md` at root |
| **Machine Data** | `python scripts/status.py --json` | Outputs JSON for scripts or CI |

---

## 4. Agent Status Workflow

Whenever an agent performs work in the project:

### Step 1: Orient (At Start of Session)
Read the top 45 lines of `STATUS.md`:
```python
view_file(AbsolutePath=".../STATUS.md", StartLine=1, EndLine=45)
```
This instantly reveals:
- The active milestone.
- The next 3 ranked priority actions.
- Any sequence gaps or pending QA.

### Step 2: Execute Assigned Task
Perform the required transformer, QA, or web building task according to that skill's rules.

### Step 3: Synchronize Status (Upon Completion)
Run the update command:
```powershell
python scripts/status.py --update
```
This updates `STATUS.md` with the new counts, marks the section as structured/QA-passed, and recalculates the next queue item automatically.

---

## 5. Status Indicators & Badges

In `STATUS.md`, sections are tracked across four pipeline columns:

| Column | Icon | Meaning |
| :--- | :---: | :--- |
| **Canon** | :white_check_mark: | Extracted from source into `canonical-sources/sections/` |
| **Canon** | :x: | Canonical extraction missing |
| **Struct** | :white_check_mark: | Transformed into `structured-content/sections/` |
| **Struct** | :white_circle: | Not yet structured |
| **QA** | :white_check_mark: | QA report verified with status `[PASS]` |
| **QA** | :warning: | QA report found discrepancies or defects |
| **QA** | :eyes: | Structured content exists, but QA report not yet run |
| **QA** | :white_circle: | Section not ready for QA |
| **Web** | :white_check_mark: | Rendered into static HTML page |
| **Web** | :white_circle: | Web page pending |

---

## 6. Definition of Success

A status tracking operation is successful when:
1. All 69 canonical sections are accurately accounted for.
2. The user can see at a glance what is built, what needs to be built, and what is next.
3. An incoming agent can grasp the full project context in a single call without token waste.
