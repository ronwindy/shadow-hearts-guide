# Template: starting a new guide project from this pipeline

Copy-and-diverge model: copy this repo, strip the game content, fill `project.config.json`.
Do not build sync tooling; copy fixes between repos by hand.

## Configure (the only game-specific names)
`project.config.json`: `game`, `slug`, `site`, `base`, `canonicalIndexFile`, `termExtrasFile`,
`statusTitle`, `pageTitleSuffix`, `pageDescriptionPrefix`, `defaultTitle`, `defaultDescription`,
`sourceDefaults`. Read by `scripts/project_config.mjs` (Node) and imported as JSON by Astro.
Also edit by hand: `.github/workflows/deploy.yml` if it names the repo, `public/` art,
`src/pages/index.astro` (hub page), and the theme tokens in `tailwind.config.mjs` / `DESIGN.md`.

## Keep unchanged
- Layout shell: `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `tailwind.config.mjs`.
- Navigation chrome: `SidebarNav`, `SidebarEntry`, `MobileNavDrawer`, `PageToc`, `Navigation`,
  `TableOfContents`, `CollapsibleSection`, `SectionHeading`.
- Page blocks: `StepChecklist`, `Callouts`, `ObjectivesList`, `SavePoints`, `DocumentInfo`,
  `SentenceList`, `NestedSentenceList`, `BadgeCard`, `GameIcon`, `ManualOverview`, `InitialSetup`.
- Controller support: `src/lib/gamepad.ts` and the `#gamepad-hints` bar in `BaseLayout.astro`.
- `scripts/`, `.claude/skills/`, `docs/structured-schema.md`, `CLAUDE.md`.

## Gamepad DOM contract (do not rename)
`gamepad.ts` finds elements only through these hooks. Any component that renders them must keep them:
`#desktop-sidebar`, `#sidebar-list`, `#sidebar-toggle`, `#page-toc`, `#mobile-drawer-panel`,
`#open-mobile-drawer`, `#close-mobile-drawer`, `#tab-btn-sections`, `#tab-content-sections`,
`#tab-content-chapters`, `#gamepad-hints`, `#gamepad-hints-dismiss`, `.step-checkbox`,
`main section[id]`, and `summary, a[href]` inside the sidebar list.

## Delete for a non-RPG game
`BossCard`, `ShopTable`, `EnemyTable`, `ItemTable`, `CharacterProfiles`, `RouteProgression`,
`ReferenceBlocks`, the PS2 glyphs in `src/lib/markup.ts`, and their imports/render blocks in
`src/pages/guide/[id].astro` and entries in `buildPageTocSections` (`src/lib/guideData.ts`).
Reset `scripts/term_extras.json` to an empty list.

## Do not copy
`.git`, `node_modules`, `dist`, `raw-sources`, `canonical-sources`, `structured-content`,
`qa-reports`, `qa-status.json`, `STATUS.md`, game art in `public/`.

## Known prefix coupling (fix when ids are slugs)
Scripts decide behavior from the `w-` / `a-1-` id prefixes: `scripts/pipeline.mjs`,
`scripts/guide.mjs`, `scripts/bold_terms.mjs`, `scaffold_structured_guide.mjs`,
`.claude/skills/qa/scripts/verify_guide.mjs`. Switch them to the section `type`.

## Start checklist
1. Copy, strip, fill `project.config.json`; `cmd /c npm run build` with zero sections.
2. User saves the source files into `raw-sources/`; import to `canonical-sources/`.
3. Write a one-page spec (source inventory, ids/slugs, schema deltas, authority rule).
4. Pilot 3 sections through `scaffold -> check -> subagent QA -> verdict -> finalize`.
5. Review bottlenecks before scaling.
