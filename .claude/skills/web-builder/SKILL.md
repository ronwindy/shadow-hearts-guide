---
name: web-builder
description: >-
  Builds polished, accessible, responsive static web pages and components (Astro, CSS, checklists, navigation) from structured guide content for deployment on GitHub Pages. Use this skill when developing, styling, building, or modifying guide web pages, layouts, or UI components without altering underlying game facts.
---

# Web Builder (runbook)

Renders `structured-content/sections/*.json` into the Astro static site (`src/`). Presents the content; never changes game facts.

## Rules (short form)
- Content integrity: every name, number, warning and ordering from structured JSON renders as given. No invented text.
- Component-based: reuse `src/components/*` (StepChecklist, BossCard, EnemyTable, ItemTable, ShopTable...). Types live in `src/lib/types.ts`, data loading in `src/lib/guideData.ts`, markup helpers in `src/lib/markup.ts`.
- Walkthroughs: objective, route, checklist steps, callouts for warnings/tips. Reference/appendix pages: scannable tables wrapped in `overflow-x-auto`.
- Responsive and accessible (mobile first, semantic HTML, contrast, keyboard nav). No internal pipeline IDs in user-facing text.
- GitHub Pages compatible: static output, respect `base` in `astro.config.mjs`.
- Don't over-engineer; style/layout questions go to the `frontend-expert` skill; design tokens are in `DESIGN.md`.

## Commands
```powershell
cmd /c npm run build
cmd /c npm test
.\scripts\run-py.cmd scripts/pipeline.py <section_id> --frontend
```

## Done when
Build passes, frontend audit has no high findings, rendered page matches structured JSON.

Full original specification (30 sections: visual hierarchy, persistence, SEO, handoff contract...): [references/full-spec.md](references/full-spec.md). Read only the section you need.
