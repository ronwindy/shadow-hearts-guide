---
name: source-importer
description: >-
  Extracts an external game-guide web page into a clean, canonical source representation preserving exact game terminology, numbers, links, tables, and ordering without altering or interpreting game knowledge. Use this skill when importing, scraping, or converting a source URL/page into the project's canonical source format.
---

# Source Importer (runbook)

All 69 sections of the current source are already imported. Use this skill only when importing a **new** source or re-running the importer.

## Source intake (URL-first)
The user provides the **source URL**. The agent chooses how to fetch it; do not ask the user to save pages manually.

1. Try a plain HTTP fetch of the URL (or a documented API such as the MediaWiki API for wiki sources).
2. If the fetch is blocked or returns a bot-check/empty page, render the URL in the built-in browser and capture the resulting HTML.
3. Write the raw HTML to `raw-sources/<slug>.html` (committed snapshot). Download referenced images into `public/<source-slug>/` (converted to webp).
4. Record source identity in the canonical JSON: URL, title, fetch date, and the method used (`http`, `api`, or `browser`).
5. Run the importer on the saved snapshot. Stop and report to the user only if every method fails.

Manual saving (SingleFile/Save As) is no longer part of the flow. Existing snapshots in `raw-sources/` remain valid inputs.

## Rules (short form)
- Extract, don't transform: keep wording, numbers, names, ordering, tables, links verbatim.
- Remove only page noise (nav, ads, footers). When unsure, keep it.
- Never resolve ambiguity, add outside knowledge, or paraphrase. Flag problems instead.
- Record source identity (URL, title, fetch date, fetch method).

## Run
```powershell
.\scripts\run-py.cmd .claude/skills/source-importer/scripts/import_gamefaqs.py [html_path] [--output-dir canonical-sources] [--no-split] [--no-subblocks] [--no-markdown]
```
Outputs: `canonical-sources/shadow-hearts-guide.canonical.json` (lightweight index), `canonical-sources/sections/<id>-<slug>.json` (per-section: nav, overview, items, enemies, bosses, shops, markers, verbatim `text`), and a canonical `.md`.

## Done when
Every section's `text` is verbatim, section order matches source, counts in the index match the section files.

Full original specification (detailed rules, examples, handoff contract): [references/full-spec.md](references/full-spec.md). Read only the section you need.
