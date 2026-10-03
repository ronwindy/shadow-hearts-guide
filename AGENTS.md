# Game Guide Converter — Agent Instructions

## 1. Project Purpose

This project converts individual game-guide source pages found on the Internet into polished, readable, easy-to-follow static web pages.

The goal is to improve the **presentation and usability** of existing guide knowledge while preserving the meaning and factual content of the original source.

The core pipeline is:

```text
Source Page
    ↓
Source Importer
    ↓
Canonical Source
    ↓
Guide Transformer
    ↓
Structured Guide Content
    ↓
Web Builder
    ↓
Static Guide Page
    ↓
QA
    ↓
GitHub Pages
```

The MVP follows a deliberately narrow scope:

> **ONE PAGE IN → ONE GOOD PAGE OUT**

### 1.1 Project Status & Token Economy

To prevent wasteful directory queries and ensure continuity between agent sessions:
- The single source of truth for project progress is [`STATUS.md`](file:///d:/Games/GameGuides/shadow-hearts-guide/STATUS.md) at the project root.
- **Before starting any task**, agents should read the first 45 lines of `STATUS.md` or run `python scripts/status.py --summary`. This gives immediate orientation (< 350 tokens) on active milestones, priorities, sequence gaps, and metrics without recursively listing directories.
- **After completing work** (e.g. creating a structured guide, completing a QA report, or building web pages), agents must run:
  ```powershell
  python scripts/status.py --update
  ```
  to keep `STATUS.md` synchronized.

---

## 2. Core Principle

### Transform Presentation, Not Knowledge

This is the most important rule in the project.

Agents may transform how information is presented, but must not independently create, alter, or speculate about game knowledge.

Allowed transformations include:

- restructuring information
- reorganizing sections
- improving wording for clarity
- summarizing repetitive wording without changing meaning
- converting prose into steps
- creating checklists
- identifying objectives
- highlighting warnings
- organizing items, rewards, locations, or encounters
- creating tables
- improving navigation
- improving readability
- creating cross-references when supported by source/project data

Agents must not:

- invent facts
- guess missing information
- add unsupported recommendations
- change item, character, location, quest, or enemy names
- change numerical values
- change requirements or prerequisites
- change ordering when ordering conveys gameplay meaning
- fabricate rewards, outcomes, locations, or mechanics
- silently resolve contradictions in the source
- present model knowledge as if it came from the source

When information is ambiguous, incomplete, or contradictory, preserve that uncertainty rather than inventing an answer.

---

## 3. Source Fidelity

The original source is the authority for the guide's factual content.

The generated guide should be traceable back to the source whenever practical.

A useful mental model is:

```text
Source Knowledge
      │
      │ must remain faithful
      ▼
Structured Representation
      │
      │ presentation transformation
      ▼
Published Guide
```

The further a transformation moves from the source, the more important factual verification becomes.

The project should optimize for:

1. factual fidelity
2. completeness
3. usability
4. readability
5. visual polish

Visual quality must never justify changing source knowledge.

---

## 4. User Role

The user is primarily the:

- source selector
- reviewer
- final decision maker
- publisher

The workflow should not assume that the user manually curates or reinterprets the underlying game knowledge.

The intended workflow is:

```text
User selects source
        ↓
Agents process source
        ↓
User reviews result
        ↓
User makes corrections if necessary
        ↓
Page is published
```

Agents should minimize unnecessary requests for manual knowledge curation.

---

## 5. MVP Scope

The MVP processes **one source page at a time**.

Do not automatically crawl an entire source website.

Do not follow every link from a source unless explicitly required by the current task.

Do not turn the project into a general-purpose wiki generator.

Do not introduce infrastructure simply because it may become useful later.

The MVP should remain simple enough to understand, debug, and manually review.

### Explicitly Out of Scope for MVP

Do not introduce:

- whole-site crawling
- automatic multi-page ingestion
- vector databases
- RAG pipelines
- knowledge graphs
- backend databases
- complex multi-agent orchestration
- automatic game-wiki generation
- autonomous research across unrelated sources

Future requirements may justify these systems, but they should not be introduced prematurely.

---

## 6. Agent Responsibilities

The project is organized around logical responsibilities rather than specific AI products.

### Source Importer

Responsible for turning a source page into a clean canonical representation.

It should preserve:

- source URL
- headings
- ordering
- paragraphs
- lists
- tables
- relevant links
- meaningful structural information

It must not rewrite or reinterpret the guide's knowledge.

---

### Guide Transformer

Responsible for transforming the canonical source into structured guide content.

It may identify and organize concepts such as:

- objectives
- steps
- sections
- routes
- locations
- items
- rewards
- encounters
- warnings
- optional content
- prerequisites

These structures must be grounded in the source.

---

### Web Builder

Responsible for turning structured guide content into a usable static website.

It owns concerns such as:

- Astro pages
- components
- CSS
- responsive layout
- navigation
- checklists
- visual hierarchy
- accessibility
- GitHub Pages compatibility

The Web Builder should not independently invent guide knowledge.

---

### QA

Responsible for verifying the generated guide against its source.

QA should look for:

- missing information
- altered facts
- invented information
- incorrect names
- incorrect locations
- missing warnings
- incorrect ordering
- broken links
- structural omissions

The central QA question is:

> **Did the presentation change while the source meaning remained intact?**

---

### Project Status & Roadmap

Responsible for tracking overall project progress across all guide sections and pipeline stages.

It manages:
- `STATUS.md` and live progress metrics
- sequence gap detection (e.g. skipped sections)
- immediate priority queues for agents
- fast, token-efficient orientation summaries

The Status Tracker audits existing artifacts; it does not alter guide content.

---

### Future Guide Librarian

The Guide Librarian is not required for the MVP.

When multiple guide pages exist, it may manage relationships between them, including:

- page ordering
- cross-links
- prerequisites
- unlock relationships
- breadcrumbs
- related pages
- progression structure

The Guide Librarian manages **relationships between pages**, not the factual content inside those pages.

---

## 7. Logical Agents vs AI Tools

Agent architecture must remain independent of any specific AI model or application.

Do not define the architecture as:

```text
ChatGPT → Agent 1
Gemini → Agent 2
Antigravity → Agent 3
```

Instead:

```text
Logical Agent
      ↓
AI Model / Tool
```

AI tools are implementation choices.

For example:

- ChatGPT may be used for planning, transformation, or QA.
- Gemini may be used for extraction or reasoning when appropriate.
- Antigravity may be used for coding, file manipulation, and web building.

These choices may change without changing the project's logical architecture.

---

## 8. Guide UX Philosophy

The generated guide should not merely look better.

It should make the guide:

> **Easier and more enjoyable to follow while playing.**

When supported by the source, useful presentation patterns include:

```text
Objective
Route
Checklist
Important / Missable
Rewards
Items
Boss / Encounter
Optional
```

For example:

```text
Chapter 5 — The Ancient Ruins

Objective
Retrieve the Ancient Key.

Route
Village → Forest → Ancient Ruins

Steps
☐ Enter the Forest
☐ Talk to Elder
☐ Enter Ancient Ruins
☐ Retrieve the key

Important
...

Rewards
...
```

These are presentation structures, not permission to invent information.

---

## 9. Page Metadata and Future Relationships

Every generated guide page should have structured metadata where practical.

Example:

```json
{
  "id": "chapter-05",
  "title": "The Ancient Ruins",
  "type": "walkthrough",
  "source": "...",
  "related_pages": [],
  "prerequisites": [],
  "unlocks": []
}
```

Relationship fields may initially be empty.

The purpose is to make future multi-page organization possible without requiring the MVP to implement a full relationship system.

Do not populate relationships based on speculation.

---

## 10. Source Boundaries

A source page defines the knowledge boundary for the current conversion.

If a fact is not present in the source, an agent should not silently add it from its own general knowledge.

If additional research is explicitly requested, the additional information must be clearly distinguished from the original source rather than silently merged into it.

The default conversion workflow is:

```text
Source → Transformation
```

not:

```text
Source → Research → AI interpretation → New Guide
```

---

## 11. Handling Uncertainty

When the source is unclear:

- preserve the ambiguity
- flag it for review
- avoid guessing
- do not manufacture certainty

When two pieces of source information appear contradictory:

- preserve the contradiction
- identify the conflicting information
- allow QA or the user to resolve it

Agents must never hide uncertainty merely to make the final guide appear polished.

---

## 12. Modification Discipline

Agents should make the smallest change necessary to accomplish their assigned responsibility.

An agent must not expand its scope simply because another improvement appears possible.

For example:

- Source Importer should not redesign the website.
- Guide Transformer should not implement Astro components.
- Web Builder should not rewrite game facts.
- QA should not silently rewrite source content.
- Guide Librarian should not rewrite individual guides.

When another responsibility is required, hand the problem to the appropriate agent instead.

---

## 13. Verification Before Completion

An agent should consider its work incomplete when its output has not been checked against the requirements of its role.

At minimum:

```text
Input
  ↓
Process
  ↓
Output
  ↓
Verify
```

Verification should focus on the agent's actual responsibility rather than performing unrelated work.

For guide content, factual fidelity takes priority over stylistic polish.

---

## 14. Change Priority

When requirements conflict, use this priority order:

1. Source fidelity
2. User requirements
3. Project architecture
4. Usability
5. Visual polish
6. Convenience

A visually impressive result that changes source knowledge is considered a failure.

---

## 15. Avoid Premature Architecture

The project should evolve from real conversion experience.

After approximately 5–10 converted pages, review the workflow and identify repeated problems before introducing new infrastructure.

Do not build future systems merely because they might eventually be useful.

Prefer:

```text
Simple working system
        ↓
Real usage
        ↓
Observed bottleneck
        ↓
Targeted automation
```

over:

```text
Theoretical future requirements
        ↓
Complex architecture
        ↓
Unused infrastructure
```

---

## 16. Definition of Success

A successful conversion should produce a guide that:

- preserves the source's factual meaning
- contains the necessary source information
- is easier to scan
- is easier to follow while playing
- has clear structure
- has useful navigation
- avoids unnecessary verbosity
- works as a static web page
- can later be incorporated into a larger game-specific guide website

The fundamental success criterion remains:

> **Make the source easier to use without turning it into a different source.**
