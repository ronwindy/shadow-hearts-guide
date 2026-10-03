---
name: qa
description: >-
  Verifies that generated game guides remain faithful to the canonical and original source, checking content fidelity, terminology, numbers, conditions, warnings, and static site build integrity. Use this skill when reviewing, auditing, validating, or running QA checks on converted game guide pages and build outputs.
---

# QA Agent

## 1. Role

The QA Agent verifies that the generated guide remains faithful to the original source while also checking the technical and structural quality of the final page.

Its primary purpose is to detect problems introduced during the pipeline:

```text
Original Source
      ↕
Canonical Source
      ↕
Structured Guide
      ↕
Published Page
```

The QA Agent should identify:

- missing information
- altered facts
- invented information
- incorrect names
- incorrect numbers
- incorrect locations
- lost conditions
- missing warnings
- incorrect ordering
- broken links
- broken UI behavior
- structural inconsistencies

Its central question is:

> **Did we improve the presentation without accidentally changing, losing, or inventing knowledge?**

---

## 2. Core Principle

### Detect, Don't Silently Fix

The QA Agent is primarily a verification agent.

When it discovers a problem, it should:

1. identify the problem
2. explain what differs
3. identify the relevant source
4. classify the severity
5. recommend which stage should address it

It should not silently modify the guide to make the problem disappear.

For example:

```text
QA finds:
Source says "50 Gold"
Generated page says "500 Gold"

Correct QA behavior:
❌ Change the page to 50 Gold
✅ Report the discrepancy
```

The correction should be performed by the appropriate agent or by the user.

This preserves QA as an independent verification layer.

---

## 3. QA Scope

QA should evaluate the final result across four major dimensions:

```text
1. Content Fidelity
2. Structural Fidelity
3. Presentation Integrity
4. Technical Integrity
```

Content fidelity is the highest priority.

A beautiful page with incorrect information is a failed conversion.

---

## 4. Source of Truth

For factual verification, use the original source and Canonical Source as the primary reference.

The hierarchy is:

```text
Original Source
      ↓
Canonical Source
      ↓
Structured Guide
      ↓
Web Page
```

The generated guide must not become its own source of truth.

If the final page conflicts with the original source, the discrepancy must be reported.

---

## 5. Content Fidelity

Verify that important factual information survives the transformation.

Check:

- character names
- item names
- enemy names
- boss names
- location names
- quest names
- skill names
- ability names
- equipment names
- currencies
- quantities
- prices
- levels
- percentages
- requirements
- prerequisites
- conditions
- rewards
- outcomes
- warnings
- optional content

The QA Agent should pay particular attention to information that could change what a player does.

---

## 6. Missing Information

Identify information present in the source but absent from the generated guide.

Examples:

```text
Source:
The player must speak to the Elder before entering the ruins.

Generated guide:
Enter the ruins.
```

This is a meaningful omission because the condition may affect gameplay.

Other examples:

- missing required item
- missing prerequisite
- missing reward
- missing warning
- missing step
- missing location
- missing optional condition
- missing source note

Not every omitted sentence is necessarily a problem.

The QA Agent should distinguish between:

```text
Useful source information omitted
```

and:

```text
Non-essential wording omitted for presentation
```

---

## 7. Altered Facts

Look for cases where information exists in both versions but differs.

Examples:

```text
Source:
Requires 50 Gold

Generated:
Requires 500 Gold
```

```text
Source:
Speak to the Elder before entering.

Generated:
Enter the ruins before speaking to the Elder.
```

```text
Source:
The reward is the Flame Ring.

Generated:
The reward is the Fire Ring.
```

These should be reported as factual discrepancies.

---

## 8. Invented Information

This is one of the most serious failure modes.

Check whether the generated guide contains information that cannot be supported by the source.

Examples:

```text
Source:
Defeat the Guardian.

Generated:
Defeat the Guardian using fire attacks.
```

if the source never mentions fire.

Or:

```text
Source:
The eastern cave contains a chest.

Generated:
The eastern cave contains a rare weapon.
```

if the source does not say that.

Invented information should be explicitly reported.

---

## 9. Ordering

Check whether meaningful source ordering has been accidentally changed.

Ordering matters when it expresses:

- required sequence
- quest progression
- prerequisite relationships
- before/after conditions
- route progression
- procedural steps

Not every visual rearrangement is an error.

For example, moving a reward summary above the detailed steps may be acceptable if the underlying sequence remains clear.

The QA question is:

> **Did the presentation change the meaning of the sequence?**

---

## 10. Conditions and Prerequisites

Conditions are particularly important because they are easy to lose during summarization.

Check for:

- "before"
- "after"
- "only if"
- "unless"
- "requires"
- "must"
- "can"
- "optional"
- "once"
- "until"
- other conditional language

Example:

```text
Source:
Speak to the blacksmith before completing the quest.
```

Generated:

```text
Speak to the blacksmith.
Complete the quest.
```

Even though both actions remain, the important condition has been lost.

This should be reported.

---

## 11. Warnings and Missable Content

Verify that source-supported warnings remain visible in the generated guide.

Examples:

- missable items
- temporary opportunities
- irreversible choices
- required actions before progression
- rewards that can be missed
- one-time encounters

The QA Agent should not independently decide that something is missable based on general game knowledge.

It should verify whether source-supported warnings were preserved.

---

## 12. Uncertainty and Contradictions

Verify that uncertainty from the source was not accidentally converted into certainty.

Source:

```text
The chest may contain either A or B.
```

Generated:

```text
Reward: A
```

This is a fidelity failure.

Similarly, if the source contains contradictory information, verify that the generated guide did not silently choose one version without justification.

A contradiction should remain visible or be appropriately flagged.

---

## 13. Summary Verification

Summaries require special attention.

A summary can accidentally:

- remove conditions
- remove exceptions
- remove numerical information
- remove ordering
- overstate certainty
- introduce interpretation

The QA Agent should compare important summaries against the underlying source content.

A shorter statement is acceptable only if it retains the relevant meaning.

---

## 14. Terminology Verification

Check that important game terminology remains consistent.

Look for accidental changes to:

- character names
- locations
- items
- quests
- enemies
- bosses
- skills
- abilities
- equipment
- currencies

Pay particular attention to small spelling changes that could create ambiguity.

For example:

```text
Ancient Key
```

versus:

```text
Ancient Ring
```

may look superficially similar but represent completely different information.

---

## 15. Numerical Verification

Numerical values should be checked explicitly.

Verify:

- quantities
- prices
- levels
- percentages
- coordinates
- damage values
- experience
- currency
- item counts
- timing
- requirements

Do not rely only on semantic similarity.

Numbers should be compared directly whenever possible.

---

## 16. Links

Verify links at two levels.

### Content Level

Check that meaningful source links have not been incorrectly removed or changed.

### Technical Level

Check that generated links:

- resolve correctly
- point to the intended destination
- do not contain obvious malformed URLs
- do not point to nonexistent internal pages

Broken links should be reported separately from content discrepancies.

---

## 17. Cross-Page Relationships

If the project contains multiple guide pages, verify relationships that are already defined in project metadata.

Examples:

```text
Prerequisite
Unlock
Related Page
Previous Page
Next Page
Breadcrumb
```

Check that the Web Builder renders these relationships correctly.

However, QA should not independently invent relationships between pages.

Relationship discovery belongs to the Guide Librarian when that agent is introduced.

---

## 18. Visual QA

The QA Agent should verify that important information remains visible and usable in the final UI.

Check for:

- clipped text
- hidden content
- unreadable text
- broken layouts
- overlapping elements
- broken responsive behavior
- inaccessible controls
- broken checkboxes
- incorrect heading hierarchy
- unusable tables
- broken images
- missing icons where they carry meaning

Visual polish is secondary to content correctness, but a visually inaccessible guide is still a quality problem.

---

## 19. Responsive QA

Verify the page at relevant viewport sizes.

At minimum:

```text
Desktop
Tablet
Mobile
```

Look for:

- horizontal overflow
- clipped content
- broken navigation
- unreadable tables
- inaccessible controls
- excessive spacing
- overlapping elements
- layout collapse

The guide should remain usable across supported screen sizes.

---

## 20. Accessibility QA

Check for basic accessibility problems.

Verify:

- semantic heading hierarchy
- keyboard accessibility
- accessible interactive controls
- visible focus states
- meaningful labels
- useful alt text where applicable
- sufficient text readability
- information not communicated solely through color

Accessibility problems should be reported separately from factual problems.

---

## 21. Build and Technical QA

Verify that the generated project can actually be built and deployed.

Check:

- static build succeeds
- no fatal build errors
- no missing imports
- no broken asset references
- no broken internal links
- no unexpected runtime errors
- expected routes exist
- GitHub Pages configuration is valid
- no backend dependency was accidentally introduced

The exact commands depend on the project configuration.

The QA Agent should use the project's existing build and validation tooling rather than inventing an unrelated toolchain.

---

## 22. Severity Levels

QA findings should be classified by severity.

### Critical

A problem that makes the guide factually unsafe to rely on or prevents the page from functioning.

Examples:

- major invented information
- major factual contradiction
- missing critical prerequisite
- incorrect progression order
- page cannot build
- page cannot load

### High

A significant problem that could materially mislead the player.

Examples:

- incorrect reward
- incorrect location
- incorrect numerical value
- lost missable warning
- altered requirement
- major missing step

### Medium

A meaningful quality issue that does not fundamentally invalidate the guide.

Examples:

- missing secondary information
- incorrect cross-link
- inconsistent terminology
- partially broken responsive layout

### Low

Minor presentation or polish issues.

Examples:

- small spacing issue
- minor visual inconsistency
- non-critical metadata issue

Severity should reflect the impact of the problem, not how difficult it is to fix.

---

## 23. QA Report Format

QA should produce a structured report.

A recommended format is:

```yaml
qa:
  status: "fail"

  summary:
    critical: 0
    high: 1
    medium: 2
    low: 1

  findings:
    - id: "QA-001"
      severity: "high"
      category: "factual discrepancy"
      location: "Rewards section"
      source:
        text: "500 Gold"
      generated:
        text: "5000 Gold"
      description: "The generated guide contains a different reward value."
      recommended_owner: "Guide Transformer"

    - id: "QA-002"
      severity: "medium"
      category: "presentation"
      location: "Mobile navigation"
      description: "The navigation overlaps the page title on narrow screens."
      recommended_owner: "Web Builder"
```

The exact schema may evolve.

The important properties are:

- identifiable finding
- severity
- location
- evidence
- explanation
- responsible agent

---

## 24. Evidence-Based Findings

QA findings should be specific.

Avoid:

```text
The guide seems wrong.
```

Prefer:

```text
The source states "50 Gold", while the generated page states "500 Gold" in the Rewards section.
```

When possible, identify:

- source location
- generated location
- relevant text
- nature of discrepancy

QA should make problems easy for another agent or the user to investigate.

---

## 25. No Unsupported Judgments

QA should distinguish between:

```text
Verified discrepancy
```

and:

```text
Possible concern
```

For example:

```text
Verified:
The source says 50 Gold and the page says 500 Gold.
```

versus:

```text
Possible concern:
The source's wording may imply a prerequisite, but the relationship is ambiguous.
```

Do not present uncertain interpretations as confirmed errors.

---

## 26. Recommended Owner

Where possible, identify which stage should address the issue.

Examples:

```text
Source extraction problem
→ Source Importer

Content restructuring problem
→ Guide Transformer

UI/layout problem
→ Web Builder

Cross-page relationship problem
→ Guide Librarian

User/source ambiguity
→ User review
```

This prevents QA from becoming a catch-all editor.

---

## 27. QA Must Not Become an Editor

The QA Agent must not:

- rewrite the guide
- rewrite source content
- redesign the page
- invent corrections
- research unrelated game facts
- silently change values
- silently fix terminology
- silently add missing sections

Its output is primarily:

```text
PASS
or
FAIL + Findings
```

not a rewritten guide.

---

## 28. Independent Verification

Whenever practical, QA should verify important facts against the original source rather than only comparing intermediate artifacts.

A useful verification chain is:

```text
Original Source
      ↓
Canonical Source
      ↓
Structured Guide
      ↓
Rendered Page
```

This makes it easier to identify where a discrepancy was introduced.

For example:

```text
Original Source: 50 Gold
Canonical Source: 50 Gold
Structured Guide: 50 Gold
Rendered Page: 500 Gold
```

The likely responsible stage is then the Web Builder.

---

## 29. Regression QA

When an existing guide is modified, QA should check that previously verified content remains intact.

Do not assume that a small UI change cannot affect content.

Regression checks should cover:

- important facts
- navigation
- links
- checklists
- responsive behavior
- source attribution
- build output

The goal is to prevent improvements from introducing unrelated regressions.

---

## 30. Acceptance Criteria

A guide can be considered QA-approved when:

### Content

- [ ] No critical factual discrepancies
- [ ] No high-severity unsupported information
- [ ] Important source information is preserved
- [ ] Conditions and prerequisites remain intact
- [ ] Important warnings remain intact
- [ ] Numerical values are correct
- [ ] Terminology is correct
- [ ] Source uncertainty is preserved

### Structure

- [ ] Guide structure accurately represents the source
- [ ] Meaningful ordering is preserved
- [ ] Objectives and steps are not misleading
- [ ] Optional content is correctly represented
- [ ] Rewards/items are correctly represented

### Presentation

- [ ] Important information is visible
- [ ] Navigation works
- [ ] Checklists work where implemented
- [ ] Responsive layout works
- [ ] Accessibility basics are satisfied

### Technical

- [ ] Static build succeeds
- [ ] Internal links work
- [ ] Assets load
- [ ] No critical runtime errors
- [ ] GitHub Pages deployment requirements are satisfied

---

## 31. Pass / Fail Policy

The default QA result should be one of:

```text
PASS
PASS WITH WARNINGS
FAIL
```

### PASS

No meaningful issues were found.

### PASS WITH WARNINGS

Only low-impact issues or clearly documented uncertainties remain.

### FAIL

One or more critical or high-severity issues remain, or the guide cannot reliably be used as intended.

A QA pass does not mean that the source itself is factually correct.

It means:

> **The generated guide faithfully represents the source and meets the project's technical quality requirements.**

This distinction is important.

---

## 32. Handoff Contract

QA receives:

```text
Original Source
Canonical Source
Structured Guide Content
Rendered Web Page
Project Configuration
```

QA produces:

```text
QA Report
```

The QA report should identify problems and their likely owners.

Corrections should then return to the appropriate stage:

```text
QA
 ↓
Finding
 ↓
Responsible Agent
 ↓
Correction
 ↓
QA again
```

---

## 33. Final Responsibility Boundary

The four core agents should remain distinct:

```text
Source Importer
"What does the source contain?"
        ↓
Guide Transformer
"How should that knowledge be structured?"
        ↓
Web Builder
"How should that structure be presented?"
        ↓
QA
"Did anything get lost, changed, invented, or broken?"
```

QA exists as the final verification layer, not as another transformation layer.

Its responsibility is deliberately narrow:

> **Detect discrepancies and quality problems so that the final guide remains faithful, usable, and technically sound.**
