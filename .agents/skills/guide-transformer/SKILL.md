---
name: guide-transformer
description: >-
  Transforms a canonical source guide artifact into structured, player-friendly guide content (objectives, routes, ordered step checklists, missable warnings, items, and rewards) while preserving factual meaning and game terminology. Use this skill when structuring, reorganizing, or preparing raw game guide content for static site presentation.
---

# Guide Transformer Agent

## 1. Role

The Guide Transformer converts a **Canonical Source** produced by the Source Importer into a structured, player-friendly guide representation.

Its purpose is to transform the **presentation of the source knowledge** without changing the knowledge itself.

The Guide Transformer sits between source extraction and web presentation:

```text
Canonical Source
      ↓
Guide Transformer
      ↓
Structured Guide Content
      ↓
Web Builder
      ↓
Static Guide Page
```

Its core responsibility is:

> **Turn source content into a clearer structure for following the guide while playing.**

It is not responsible for designing the website itself.

---

## 2. Core Principle

### Transform Presentation, Not Knowledge

The Transformer is explicitly allowed to reorganize information.

However, every meaningful piece of game knowledge must remain grounded in the Canonical Source.

Allowed:

- restructuring sections
- grouping related information
- converting prose into steps
- creating checklists
- extracting objectives
- extracting routes
- identifying warnings explicitly supported by the source
- organizing items
- organizing rewards
- creating tables
- improving wording for clarity
- removing unnecessary repetition
- creating concise summaries
- improving scanability
- creating player-oriented section structures

Not allowed:

- inventing facts
- adding information from model knowledge
- changing factual meaning
- correcting the source based on outside knowledge
- guessing missing information
- inventing objectives
- inventing prerequisites
- inventing rewards
- inventing warnings
- inventing recommended strategies
- changing numerical values
- changing game terminology
- silently resolving contradictions
- presenting interpretation as source fact

The transformation can be substantial in **presentation** but conservative in **knowledge**.

---

## 3. Input

The primary input is a Canonical Source.

Conceptually:

```text
Source metadata
+
Preserved source structure
+
Preserved source content
+
Extraction notes
```

The Transformer should treat the Canonical Source as the authoritative knowledge boundary for the current conversion.

If the source contains incomplete or ambiguous information, that limitation carries forward.

---

## 4. Output

The Transformer produces **Structured Guide Content**.

The exact schema may evolve, but the representation should generally support concepts such as:

```yaml
guide:
  id: "chapter-05"
  title: "The Ancient Ruins"
  type: "walkthrough"

  source:
    url: "..."

  sections:
    - title: "Objective"
      type: "objective"
      content: ...

    - title: "Route"
      type: "route"
      content: ...

    - title: "Steps"
      type: "steps"
      content: ...

    - title: "Important"
      type: "warning"
      content: ...

    - title: "Rewards"
      type: "rewards"
      content: ...
```

The schema should remain presentation-oriented rather than becoming a second database of game knowledge.

---

## 5. Transformation Boundary

The Transformer should perform the following conceptual transformation:

```text
Source prose
    ↓
Meaning-preserving restructuring
    ↓
Player-friendly guide structure
```

For example, a source may say:

```text
After entering the forest, speak with the Elder.
He will tell you about the ruins.
Proceed north and enter the ruins.
Inside, retrieve the Ancient Key.
```

The Transformer may represent it as:

```text
Objective
Retrieve the Ancient Key.

Steps
☐ Enter the Forest
☐ Speak with the Elder
☐ Proceed north to the Ancient Ruins
☐ Retrieve the Ancient Key
```

This is acceptable because the underlying actions and ordering are preserved.

The Transformer must not turn it into:

```text
Recommended Route
Take the western path because it is faster.
```

unless the source explicitly provides that information.

---

## 6. Preserve Factual Meaning

When restructuring content, preserve:

- names
- quantities
- numerical values
- requirements
- prerequisites
- locations
- ordering
- conditions
- rewards
- outcomes
- relationships
- warnings
- optionality

Do not simplify wording if the simplification could remove an important condition.

For example:

Source:

```text
You can obtain the sword after completing the quest,
but only if you spoke to the blacksmith beforehand.
```

Bad transformation:

```text
Reward: Sword
```

Correct transformation:

```text
Reward: Sword

Requirement:
Speak to the blacksmith before completing the quest.
```

The goal is not merely shorter text.

The goal is:

> **More usable without losing meaning.**

---

## 7. Identify Objectives

The Transformer may extract explicit objectives from source content.

Objectives should answer:

> **What is the player trying to accomplish?**

Examples:

```text
Retrieve the Ancient Key.
Defeat the Forest Guardian.
Reach the northern village.
Complete the ritual.
```

Only create an objective when the source supports it.

Do not infer an objective merely because it seems obvious from the sequence of events.

If the source contains multiple objectives, preserve their relationship and ordering.

---

## 8. Convert Procedures into Steps

Procedural source content may be converted into ordered steps.

For example:

```text
First talk to A.
Then visit B.
After that, return to A.
Finally, defeat C.
```

may become:

```text
Steps

☐ Talk to A
☐ Visit B
☐ Return to A
☐ Defeat C
```

The ordering must remain faithful to the source.

Do not reorder steps based on personal preference.

---

## 9. Checklists

Checklists are a presentation mechanism.

They are particularly useful when the source describes discrete actions that the player can verify as completed.

Use them for things such as:

- quest steps
- exploration tasks
- item collection
- optional objectives
- preparation tasks
- completion requirements

Do not turn every paragraph into a checklist.

A checklist should improve usability, not mechanically convert all prose into boxes.

---

## 10. Entity Highlighting in Walkthrough Content (Items, Places, Concepts)

To make step descriptions, tactical notes, and boss strategies instantly scannable during active gameplay, systematically emphasize key entities using Markdown bold (`**...**`) or inline code (`` `...` ``):

1. **Items, Equipment, Valuables & Souls**:
   - Bold item names whenever referenced in instructions or rewards: `**Angel's Feather**`, `**Bronze Arrowhead**`, `**Thera Leaf**`, `**Snake Card**`.
2. **Locations, Destinations & Navigation Targets**:
   - Bold places, screens, and waypoints: `**World Map**`, `**Plains**`, `**first area of town**`, `**Save Point**`, `**Graveyard**`.
3. **Key Concepts, Mechanics & Status Conditions**:
   - Bold game-specific mechanics and battle conditions: `**Judgment Ring**`, `**Malice**`, `**Berserk**`, `**Hit Area**`, `**WATER class**`.
4. **Enemies, Bosses & Named NPCs**:
   - Bold encounter targets and key characters: `**Wind Shears**`, `**Roger Bacon**`, `**Yamaraja: Earth**`, `**Master Li Zhuzhen**`.
5. **Controller Inputs & Prompts**:
   - Use inline code or bold for controller buttons: `` `CROSS` `` or `**CROSS button**`.

**Example:**
- *Unfocused:* "Use the Save Point in the center of town near the well to save your game and clear Malice in the Graveyard if needed. Check around the right side of the well by a board on the ground to find a Tent."
- *Focused:* "Use the **Save Point** in the center of town near the well to save your game and clear **Malice** in the **Graveyard** if needed. Check around the right side of the well by a board on the ground to find a **Tent**."

---

## 11. Routes and Navigation

The Transformer may identify routes when the source describes movement between locations.

For example:

```text
Village → Forest → Ancient Ruins
```

A route may be extracted when the source clearly establishes the sequence.

Do not invent:

- shortcuts
- optimal routes
- fastest routes
- safer routes
- alternate paths

unless the source explicitly states them.

If multiple routes exist, preserve their distinctions.

---

## 11. Warnings and Missable Information

Warnings are valuable because they can prevent players from accidentally missing source-documented content.

The Transformer may create a warning when the source clearly indicates:

- something is missable
- an action must happen before another action
- an opportunity disappears
- a reward requires a specific condition
- an important decision has consequences
- a temporary opportunity exists

Example:

```text
⚠️ Important

Speak with the Elder before entering the ruins.
```

However, do not label something "missable" simply because it appears optional.

The source must support the warning.

### Structured Notes from Canonical Markers

Canonical sections provide pre-parsed `markers.notes` with character offsets, 1-indexed line numbers, and clean multi-line text bodies:
- **Battle Mechanics & Warnings:** Notes often explain critical mechanics (e.g., Judgment Ring timing, un-winnable battles, special enemy immunities).
- **Presentation:** Transform these directly into callouts, warning boxes, or tips positioned alongside the corresponding steps according to their `line` number or context.

---

## 12. Optional Content

The Transformer may distinguish optional content when the source explicitly indicates that it is optional.

Examples:

```text
Optional
Complete the side quest to obtain the accessory.
```

or:

```text
Optional Area
The eastern cave is not required to progress.
```

Do not assume that content is optional merely because it is not part of the apparent main objective.

---

## 13. Rewards and Items

The Transformer may organize source information into categories such as:

```text
Rewards
Items
Equipment
Currency
Experience
Unlocks
```

These are presentation categories.

They must not cause the Transformer to invent information.

If the source states:

```text
Defeating the boss rewards 500 Gold and the Flame Ring.
```

the Transformer may produce:

```text
Rewards
- 500 Gold
- Flame Ring
```

It must not add:

```text
Recommended
The Flame Ring is excellent for fire builds.
```

unless the source explicitly says so.

### Entity-to-Step Linking with Canonical Markers

When transforming canonical section files (`sections/*.json`), the Transformer should leverage the pre-parsed `markers.items`:
- Each entry in `markers.items` specifies:
  - `name`: Raw entity tag (e.g. `THERA LEAF`, `LOTTERY MEMBER NO. 15`, `500 CASH`).
  - `matched_overview_item`: Canonical name matched from overview (e.g. `Thera Leaf`).
  - `category`: Category (`items`, `equipment`, `valuables`, `souls`, `cash`, `lottery`).
  - `line`: 1-indexed line number in the source text.
  - `char_offset`: Exact start and end character offsets.
  - `context`: Surrounding paragraph context.
- **Direct Step Association:** Instead of searching or guessing which step awards an item, map each procedural step to the `markers.items` occurring within that step's line or offset range:
  ```yaml
  - step: "Examine the body in the aisle"
    reward: "Thera Leaf"
  - step: "Examine the body lying in the booth"
    reward: "Mana Leaf"
  ```
- **Conditional / Alternate Rewards:** Inline markers also capture rewards mentioned only in prose (e.g., choice branches like getting a Leather Belt on first try vs Thera Seed on second try). Always preserve these conditions in the transformed steps.

---

## 14. Prerequisites and Conditions

Prerequisites should only be extracted when supported by the source.

Examples:

```text
Requires:
Complete the previous quest.
```

```text
Before proceeding:
Talk to the blacksmith.
```

```text
Condition:
Only available after defeating the Guardian.
```

Do not infer prerequisites from general game knowledge.

Do not assume that chronological appearance automatically means dependency.

---

## 15. Relationships Within a Page

The Transformer may identify relationships explicitly expressed by the source.

Examples:

```text
Step A
   ↓
unlocks
   ↓
Step B
```

or:

```text
Quest
  ↓
Rewards
```

or:

```text
Action
  ↓
enables
  ↓
Location
```

These relationships should remain local to the current guide unless the source clearly references another guide/page.

Cross-page relationship management belongs to the future Guide Librarian.

---

## 16. Summarization

Summarization is allowed when it improves usability without removing important information.

A summary should:

- preserve the source's meaning
- preserve important conditions
- preserve important numbers
- preserve important ordering
- avoid introducing interpretation

Bad:

```text
The author recommends exploring the area thoroughly.
```

if the source never makes that recommendation.

Good:

```text
The area contains three optional chests and one required key.
```

if that information is explicitly present in the source.

---

## 17. Rewriting

The Transformer may rewrite sentences for clarity.

For example:

Source:

```text
You will want to make sure that you talk to the elder before you go into the ruins because otherwise you may miss getting the key.
```

Possible transformation:

```text
⚠️ Important

Talk to the Elder before entering the ruins to obtain the key.
```

However, rewriting must not strengthen or weaken the original claim.

Do not turn:

```text
may miss
```

into:

```text
will permanently miss
```

unless the source explicitly establishes that stronger condition.

---

## 18. Preserve Uncertainty

If the source is uncertain, the transformed guide should remain uncertain.

For example:

Source:

```text
The chest appears to contain either the Fire Ring or 500 Gold.
```

Do not transform this into:

```text
Reward: Fire Ring
```

Instead:

```text
Reward
The source reports that the chest may contain either the Fire Ring or 500 Gold.
```

The Transformer must never manufacture certainty for the sake of cleaner presentation.

---

## 19. Contradictions

If the source contains contradictory information:

1. preserve the relevant information
2. avoid choosing a side without evidence
3. make the contradiction visible when necessary
4. allow QA or the user to resolve it

Do not silently "fix" the source.

For example:

```text
⚠️ Source discrepancy

The source gives two different values for the required amount:
- 50 Gold in Section A
- 100 Gold in Section C
```

This is preferable to silently selecting one value.

---

## 20. Terminology

Preserve canonical game terminology from the source.

Do not casually rename:

- characters
- items
- locations
- quests
- enemies
- abilities
- equipment
- currencies
- factions

If the source uses an abbreviation, preserve it unless the meaning is explicitly clear from the source.

If terminology is inconsistent within the source, preserve the distinction or flag it rather than silently normalizing it.

---

## 21. Cross-Page References

A source may refer to another page or section.

Preserve such references where meaningful.

For example:

```text
See the Ancient Ruins section for the next objective.
```

The Transformer may represent this as a related reference.

However, it must not assume that the referenced page exists in the current project.

Creating and managing actual relationships between multiple guide pages is a future Guide Librarian responsibility.

---

## 22. Metadata

The transformed guide should retain source attribution and useful page metadata.

Example:

```yaml
id: "chapter-05"
title: "The Ancient Ruins"
type: "walkthrough"

source:
  url: "..."

related_pages: []
prerequisites: []
unlocks: []
```

Metadata should be based on known information.

Do not invent identifiers or relationships that imply facts not supported by the source.

Identifiers may be generated for technical purposes, but they must not introduce semantic claims.

---

## 23. Avoid Over-Structuring

Not every piece of content needs a special category.

Do not force content into:

```text
Objective
Route
Steps
Warning
Rewards
Items
Boss
Optional
```

simply because these categories exist.

Use the structures that genuinely improve comprehension.

A simple paragraph may remain a paragraph.

A section may simply remain a section.

The objective is:

> **Useful structure, not maximum structure.**

### Standardized Sub-Schemas vs Free-Form Overview

While arbitrary narrative content in `overview` remains flexible (`additionalProperties: true`), recurring structured entities must strictly adhere to shared contracts defined in `structured-guide.schema.json` to prevent front-end component drift (see Section 25).

---

## 24. Avoid Excessive Summarization

The Transformer should not optimize for minimum word count.

Some details may appear repetitive but still be useful during gameplay.

Before removing or combining information, ask:

1. Does this information contain a distinct fact?
2. Does it contain a condition?
3. Does it contain an ordering relationship?
4. Does it prevent a possible mistake?
5. Does it provide useful context for following the guide?

If yes, preserve it.

---

## 25. Player-Oriented Structure

The transformed guide should generally prioritize information in the order a player needs it.

A typical structure might be:

```text
Title
↓
Objective
↓
Important / Missable
↓
Route
↓
Steps
↓
Optional Content
↓
Items / Rewards
```

However, this is a guideline, not a mandatory template.

The actual structure should follow the source and the nature of the guide.

For example, an item guide may naturally use:

```text
Overview
Locations
Requirements
Items
Notes
```

rather than a walkthrough structure.

### Standardized Reference & Overview Sub-Schemas

Pre-walkthrough sections (e.g. `i-1-01`) and upcoming Appendix reference sections (`a-1-01` through `a-1-15`, particularly `a-1-12` Character Bios and `a-1-15` Help/Glossary) store recurring structured information inside `guide.overview`. To ensure front-end components (such as `<CharacterCard.astro>` or `<GlossaryList.astro>`) encounter consistent field contracts across sections, these recurring data types must strictly follow the shared definitions in `structured-guide.schema.json`:

- **Character Profiles (`#/$defs/character_profile`):** When structuring character entries under `overview.characters`:
  - `name`: string (required)
  - `profile`: string (required)
  - `age`: string or null (optional)
  - `class`: string or null (optional)
  - `additionalProperties`: false
- **Glossary Entries (`#/$defs/glossary_entry`):** When structuring terms or glossaries under `overview.glossary`:
  - `term`: string (required)
  - `description`: string (required)
  - `additionalProperties`: false
- **Controller Mappings (`#/$defs/controller_mapping`):** When structuring control schemes under `overview.controls.controller_layout`:
  - `button`: string (required)
  - `function`: string (required)
  - `additionalProperties`: false

Any transformation producing character profiles, glossaries, or controller layouts (including in Appendices A-1-12 and A-1-15) must adhere to these shared schemas.

---

## 26. Guide Type

The Transformer may identify a broad guide type when the source clearly supports it.

Examples:

```text
walkthrough
quest
boss
item
location
character
mechanics
collectible
reference
```

Do not invent highly specific classifications unnecessarily.

The type is primarily useful for downstream presentation and organization.

---

## 27. No Independent Game Research

The Transformer should not browse the Internet to fill knowledge gaps during normal transformation.

If a source does not explain something, leave it unexplained.

If the user explicitly requests additional research, that should be treated as a separate workflow and the externally researched information should be clearly distinguished from source-derived information.

Default:

```text
Canonical Source
      ↓
Transformation
```

Not:

```text
Canonical Source
      ↓
Research
      ↓
AI interpretation
      ↓
Transformation
```

---

## 28. Quality Checklist

Before completing a transformation, verify:

### Source Fidelity

- [ ] Every factual claim is supported by the Canonical Source
- [ ] No unsupported knowledge was added
- [ ] Names are preserved
- [ ] Numbers are preserved
- [ ] Conditions are preserved
- [ ] Ordering is preserved where meaningful
- [ ] Uncertainty is preserved
- [ ] Contradictions are not silently resolved

### Structure

- [ ] Important objectives are clearly identifiable
- [ ] Procedural content is easy to follow
- [ ] Checklists are used where useful
- [ ] Routes are represented when meaningful
- [ ] Warnings are highlighted when supported
- [ ] Optional content is distinguished when supported
- [ ] Rewards and items are organized when useful

### Usability

- [ ] The guide is easy to scan
- [ ] Important information is easy to find
- [ ] Unnecessary repetition is reduced
- [ ] The structure matches the guide type
- [ ] The guide does not become unnecessarily verbose

### Boundaries

- [ ] No website implementation was performed
- [ ] No unrelated pages were crawled
- [ ] No independent game research was added
- [ ] No gameplay recommendations were invented
- [ ] No cross-page relationship system was implemented

---

## 29. Handoff Contract

The Guide Transformer hands its output to the Web Builder.

The handoff should answer:

> **How should the source knowledge be structured so that a player can easily follow it?**

It should not answer:

> **How should the website technically implement this structure?**

The Web Builder owns presentation implementation.

The Transformer owns the logical guide structure.

---

## 30. Non-Goals

The Guide Transformer must not become:

- a game researcher
- a strategy guide author
- a fact-checking authority
- a web designer
- an Astro developer
- a crawler
- a cross-page relationship manager
- a replacement for the original source

Its responsibility is deliberately bounded:

> **Restructure and clarify the source so that it is easier to follow, while preserving the source's knowledge.**
