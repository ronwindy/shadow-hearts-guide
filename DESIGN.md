# Shadow Hearts Guide — Design System (`DESIGN.md`)

## 1. Design Vision & Tone

The visual design system of the **Shadow Hearts Guide** is inspired by the early 2000s gothic horror and occult fantasy atmosphere of *Shadow Hearts* (PlayStation 2, 2001), while strictly adhering to modern standards of web readability, scanability, performance, and accessibility.

### Core Philosophy
1. **Atmospheric yet Utilitarian**: Immerses the reader in a dark gothic mood (deep charcoal, ancient parchment, Judgement Ring bronze/gold, crimson danger accents) without obscuring readability or scan speed while actively playing the game.
2. **Scanability First**: Clear information hierarchy with distinct badges, cards, step checklists, and callouts so players can glance between their controller and screen without losing their place.
3. **Strict Content Integrity**: Design components never invent, modify, or extrapolate game data. Empty sections are omitted rather than filled with placeholder fiction.
4. **Lightweight & Dependency-Free**: Minimal static CSS/HTML; zero heavy frontend JavaScript bundles.

---

## 2. Color Palette (Design Tokens)

The palette balances dark gothic aesthetics with strict WCAG AA contrast standards.

### Primary & Neutral Tones
- **Canvas / Background Root**: `#0c0e14` (Deep Obsidian / Midnight Void)
- **Surface Elevation 1 (Cards, sidebars)**: `#141822` (Dark Slate)
- **Surface Elevation 2 (Hover, nested cards)**: `#1c2230` (Charcoal Surface)
- **Border / Divider**: `#2d3748` (Muted Iron)
- **Border Subtle**: `#1e2638`

### Typography Colors
- **Text Primary (Headings, primary body)**: `#f1f5f9` (Parchment Crisp White - 95% opacity)
- **Text Secondary (Subtitles, descriptions)**: `#94a3b8` (Muted Silver - Slate 400)
- **Text Muted (Metadata, footnotes, labels)**: `#64748b` (Slate 500)

### Thematic Accent Colors
- **Judgement Ring Gold / Bronze (Primary Accent)**:
  - Base: `#d4af37` (Antique Gold)
  - Hover / Light: `#f59e0b` (Amber Gold)
  - Dark / Border: `#854d0e`
- **Malice Crimson (Warnings, Bosses, Missables)**:
  - Base: `#e11d48` (Blood Crimson)
  - Background Tint: `rgba(225, 29, 72, 0.12)`
  - Border: `#9f1239`
- **Sanctuary Cyan / Sapphire (Information, Magic, Seals)**:
  - Base: `#38bdf8` (Ethereal Cyan)
  - Background Tint: `rgba(56, 189, 248, 0.12)`
  - Border: `#0369a1`
- **Verdant Emerald (Checklists Completed, Safe Zones, Items Obtained)**:
  - Base: `#10b981` (Emerald)
  - Background Tint: `rgba(16, 185, 129, 0.12)`
  - Border: `#047857`

---

## 3. Typography

- **Headings Font**: `'Cinzel', 'Trajan Pro', 'Georgia', serif` at semibold (600)
  - Evokes classical occult manuscripts and gothic architecture. Tailwind `serif`.
- **Body / UI / Numbers Font**: `'Jost', 'Inter', system-ui, -apple-system, sans-serif`
  - Body text, stats, numbers, badges, and controls. Tailwind `sans` and `mono`.

### Scale
- **H1 (Page Title)**: `2.25rem` (36px) — Bold / Semibold, tracking-tight, gold accent
- **H2 (Section Header)**: `1.5rem` (24px) — Semibold, gothic serif, border-bottom accent
- **H3 (Sub-section / Card Header)**: `1.25rem` (20px) — Medium / Semibold
- **Body Regular**: `1rem` (16px) — Line height `1.65`
- **Caption / Metadata**: `0.875rem` (14px) — Line height `1.4`
- **Micro Badge / Tags**: `0.75rem` (12px) — Uppercase, letter-spacing `0.05em`

---

## 4. UI Components

### 4.1 Header & Navigation
- **Sticky / Fixed Top Bar**: Clean glassmorphism (`backdrop-blur-md`, `bg-[#0c0e14]/85`).
- **Brand / Title**: "Shadow Hearts" in antique gold serif with companion badge "Strategy Guide & Walkthrough".
- **Navigation Links**:
  - `Home` (`/`)
  - `Table of Contents` (`/toc`)
  - `Walkthrough` (Quick dropdown or link)
  - `Appendices`
  - `Original Source` (External link to GameFAQs source)

### 4.2 Cards & Containers
- **Card Base**:
  - Background: `#141822`
  - Border: `1px solid #2d3748`
  - Rounded corners: `rounded-lg` (8px)
  - Subtle box shadow: `0 4px 12px rgba(0, 0, 0, 0.4)`
- **Hover Effect**: Border transition to gold `#d4af37` or slate highlight on interactive cards.

### 4.3 Section Code Badges
- **Walkthrough Major**: `bg-amber-950/60 text-amber-300 border-amber-700/60 font-mono text-xs px-2 py-0.5 rounded`
- **Sidequest Tag (`*`)**: `bg-purple-950/60 text-purple-300 border-purple-700/60 text-xs px-2 py-0.5 rounded`
- **Appendix Tag**: `bg-blue-950/60 text-blue-300 border-blue-700/60 font-mono text-xs px-2 py-0.5 rounded`

### 4.4 Callouts & Alerts
- **Warning / Missable Alert**:
  - Border-left: `4px solid #e11d48`
  - Background: `rgba(225, 29, 72, 0.08)`
  - Icon: Exclamation triangle or Malice emblem
- **Tip / Strategy Callout**:
  - Border-left: `4px solid #38bdf8`
  - Background: `rgba(56, 189, 248, 0.08)`
  - Icon: Info circle or ring glyph

### 4.5 Interactive Checklists
- Custom styled checkboxes with emerald check marks.
- Checked state: Text dims (`text-slate-500 line-through`) and local storage persists completion without requiring an account or server.

### 4.6 Table of Contents (TOC) Component
- **Search / Filter Input**: Instant live filtering of all 69 sections by name or code (`[W-1-01]`, `[A-1-05]`, etc.).
- **Category Grouping**:
  1. *Introduction*
  2. *Walkthrough - Shadow Hearts (Asia)*
  3. *Walkthrough - Shadow Hearts (Europe)*
  4. *Appendices & Reference*
  5. *Conclusion*
- **Status Indicators**:
  - Ready / Converted: Highlighted with direct link.
  - In Progress / Canonical: Distinct muted indicator showing complete roadmap coverage.

---

## 5. Responsive Breakpoints

- **Mobile (< 640px)**: Single column stack, sticky navigation drawer, compact code badges, full-width touch targets.
- **Tablet (640px - 1024px)**: 2-column grids for TOC categories and overview cards.
- **Desktop (> 1024px)**: 3-column / sidebar layout where applicable, generous margins (`max-w-6xl` or `max-w-7xl`).

---

## 6. Accessibility & Web Standards

- **Contrast**: High contrast ratio (> 7:1 for headings, > 4.5:1 for body copy).
- **Semantics**: Native HTML5 elements (`<header>`, `<main>`, `<nav>`, `<article>`, `<section>`, `<footer>`).
- **Focus Rings**: Clearly visible amber focus outline (`outline-2 outline-amber-400 offset-2`) on keyboard navigation.
- **Non-Reliance on Color**: Badges and status states always pair color with text labels or distinct symbols (e.g., `* Sidequest`, `[W-1-01]`).
