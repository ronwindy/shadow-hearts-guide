# Structured Guide Schema Reference

How to write `structured-content/sections/<file>.json` by hand (or refine a scaffold).
Authoritative definition: `.claude/skills/guide-transformer/schemas/structured-guide.schema.json`
(enforced by `scripts/pipeline.py <id> --validate`). Worked examples:
`structured-content/sections/w-1-05-dalian.json`, `w-1-06-smuggler-s-boat.json`.

> **Rule zero:** presentation changes, game facts do not. Every name, number and
> condition comes from `canonical-sources/sections/<file>.json`. Ambiguity or an apparent
> source typo is preserved and flagged in a note (`type: "discrepancy"`), never fixed.

## 1. File shape

A single object with one key, `guide`. Unknown keys anywhere under `guide` are rejected
(`additionalProperties: false`) except where noted.

```json
{
  "guide": {
    "id": "w-1-06",
    "code": "[W-1-06]",
    "title": "Smuggler's Boat",
    "type": "walkthrough",
    "category": "Walkthrough - Asia",
    "source": { "game": "Shadow Hearts", "author": "A_Backdated_Future", "version": "1.05", "url": "", "source_file": "" },
    "navigation": { "prev": { "id": "", "code": "", "title": "", "file": "" }, "next": { "...": "..." } },
    "route": ["Below deck"],
    "objectives": ["Defeat Li Li", "Proceed to Shanghai, Huayuan (1)"],
    "items_summary": { "obtainable": [], "initial": [] },
    "enemies": [],
    "bosses": [],
    "shops": [],
    "steps": []
  }
}
```

### Guide-level fields

| Field | Req. | Notes |
| :-- | :-: | :-- |
| `id` | yes | Lowercase slug, `^[a-z0-9-]+$` (e.g. `w-1-06`). Copy from canonical. |
| `code` | yes | Bracketed code, e.g. `[W-1-06]`. Copy from canonical. |
| `title` | yes | Copy from canonical. |
| `type` | yes | `walkthrough`, `walkthrough_intro`, `sidequest`, `mechanics`, `reference`. |
| `category` | yes | Copy from canonical (e.g. `Walkthrough - Asia`). |
| `source` | yes | `game`, `author`, `version` required; `url`, `source_url`, `source_file` optional; extra keys allowed. |
| `navigation` | yes | `prev` / `next`: `null` or `{id, code, title, file}` (all four required). Copy from canonical. |
| `route` | no | Ordered list of location strings. |
| `objectives` | no | Short goal strings. Only what the source states; never derived from `navigation.next` (a source may offer a branch). QA flags wording that is not traceable. |
| `save_points` | no | Strings copied verbatim from the canonical `overview.save_points` (not a route). Shown as a "Save Points" section; QA requires them. |
| `items_summary` | no | See section 3. |
| `enemies` | no | Copy of canonical `enemies` (section 5). |
| `bosses` | no | Boss cards (section 5). |
| `boss` | no | Alias for a single boss / array / `null`, mirrors canonical. Copy if canonical has it. |
| `shops` | no | `[{name, inventory:[{name, price:int}]}]`. Copy from canonical. |
| `steps` | no | The walkthrough checklist (section 2). |
| `callouts` | no | Section-level notes `{type, title, text}` (same `type` enum as step notes). |
| `initial_setup`, `overview` | no | Intro/manual sections only (character profiles, glossary, controls). |
| `reference_blocks` | no | Appendix sections: `[{title?, format:"preformatted", text}]`. Produced by the scaffold, never hand-edited; QA requires byte-identical text. |

`type` of a section by canonical id: `w-*` -> `walkthrough` (`sidequest` when canonical
`is_sidequest`, `walkthrough_intro` when the overview has `directions`); `a-1-01..15` ->
`reference`.

## 2. Steps

`steps[]` is the checklist the reader ticks off. Order is source order and carries meaning.

| Field | Req. | Type | Notes |
| :-- | :-: | :-- | :-- |
| `id` | yes | integer | 1, 2, 3... unique, sequential. Referenced from `items_summary.location` ("step N"). |
| `description` | yes | string | What to do. Markdown-lite (see section 6). |
| `type` | yes | enum | See below. |
| `rewards` | no | array | Items obtained in this step (section 4). Emit `[]` when none. |
| `notes` | no | array | Callouts attached to the step (section 3.2). |
| `choices` | no | array | Dialogue options (section 7). |
| `encounter` | no | `{enemies: [string \| object]}` | Enemy names fought here; names must match `enemies[].name`. |
| `boss` | no | boss card | Inline boss/sub-boss fought in this step (alternative to `bosses[]`; QA counts both). |

Steps accept **only** those keys. Anything else fails validation.

### 2.1 Allowed step `type` values

Exactly these 12 (schema enum): `story`, `exploration`, `battle`, `boss`, `loot`, `puzzle`,
`shop`, `dialogue`, `navigation`, `quest`, `preparation`, `misc`.

| Value | Use when the step is mainly... |
| :-- | :-- |
| `exploration` | walking/searching a map; the default |
| `navigation` | travelling between areas / the World Map |
| `loot` | collecting named items (has `rewards`) |
| `shop` | buying/selling; a vendor inventory is the point |
| `story` | watching a scene/event |
| `dialogue` | a choice or conversation with options (`choices`) |
| `battle` | a regular fight / group of enemies |
| `boss` | a named boss or sub-boss fight (card in `step.boss` or `bosses[]`) |
| `puzzle` | a puzzle/mechanism |
| `preparation` | readying before a fight (equipment, healing, saving) |
| `quest` | an explicit side-quest task |
| `misc` | nothing above fits |

Rendering note: the step badge only distinguishes Combat (`battle`, `boss`), Treasure
(`loot`), Story (`story`), Puzzle (`puzzle`); every other value shows as Explore. The
distinction is still kept in data.

## 3. Items and notes

### 3.1 `items_summary`

```json
"items_summary": {
  "obtainable": [
    { "name": "Rosewood Bracelet", "category": "equipment", "location": "<where, from source> (step 1)",
      "missable": false, "condition": "" }
  ],
  "initial": [ { "name": "Pocket Watch", "category": "equipment" } ]
}
```

- `obtainable[]`: required `name`, `category`; optional `location`, `missable` (bool), `condition`.
  One entry per canonical overview item (`items`, `equipment`, `valuables`, `lottery`, `souls`).
- `initial[]`: overview entries marked `*` (already owned). `name`, `category` only.
- **Names are copied exactly as in `canonical.overview`.** Do not merge, split, re-case or
  tidy them. Example: the overview lists `Lottery Member No. 13` and `(Courier Subordinate)`
  as two lines; both stay as two entries. QA flags any overview name it cannot find.
- `category` mirrors the overview key: `items`, `equipment`, `valuables`, `lottery`, `souls`.
- `location`: a short, source-backed pointer. The scaffold fills it with the source sentence
  plus `(step N)`; shorten by hand only by cutting words, never by adding facts. Leave `""`
  when the text does not say.
- Set `missable: true` only when the source says it can be missed.
- Items tagged in the narrative but absent from the canonical overview (e.g. `B.Dragon Horn` in w-1-07) are **not** added to `obtainable`: the overview is the authority for this list. They stay as step `rewards`; `--lint` reports them as `narrative-item` (info).

### 3.2 Step `notes`

```json
"notes": [
  {
    "type": "missable",
    "title": "Win the Iron Clogs",
    "text": "Make sure to win them before continuing on.",
    "table": { "headers": ["Color", "Prize"], "rows": [ { "range": "Red", "reward": "Iron Clogs" } ] },
    "badges": [ { "label": "Evil 1", "range": "Blue -> Turquoise", "color": "cyan" } ]
  }
]
```

`type`, `title`, `text` are required. `table` and `badges` are optional.

**Allowed note `type` values** (same enum for step notes and `callouts[]`):
`tutorial`, `warning`, `tip`, `missable`, `lore`, `strategy`, `discrepancy`.

| Type | Meaning |
| :-- | :-- |
| `warning` | permanent consequences, dangerous/unwinnable fights, status threats |
| `missable` | an item/event that can be lost if skipped |
| `tutorial` | how a mechanic works (Judgment Ring, fusions, pawn shop...) |
| `tip` | advice, recommended setup, efficiency |
| `lore` | story/world context |
| `strategy` | tactics; suppressed on a step when the boss card already carries `strategy` |
| `discrepancy` | the source is contradictory/typo'd; state both readings, resolve nothing |

Currently rendered with identical styling regardless of type; the type is still data.

**`table`** (`{headers: string[], rows: object[]}`) - for prize/value lookups:

- Each row has required `range` (the left-hand key: a color, an attempt range, "One"...)
  and `reward` (the right-hand value, as written in the source).
- Optional per row: `is_unique` (bool), `category` (string).
- `headers` are the column titles shown above (conventionally two: left = `range`, right = `reward`).
  The same two keys are used even when the left column is not numeric.
- Values stay verbatim: `TalismanOfLuck`, `B.Dragon Horn`, `500 Cash`.

**`badges`** - colored range chips (`[{label, range, color}]`, all but `color` required).
`color` is one of `cyan`, `emerald`, `amber`, `rose` as rendered; unknown colors fall back to a neutral style.

## 4. Rewards

```json
"rewards": [
  { "name": "Lottery Ticket", "category": "items", "matched_overview_item": "Lottery Ticket",
    "quantity": 1, "condition": "if you win" }
]
```

- Required: `name`, `category`. Optional: `matched_overview_item`, `quantity` (int or string), `condition`.
- Set `matched_overview_item` to the exact overview name whenever the item is in the overview.
  The scaffold derives rewards from `[_ITEM_]` tags in the source text; unmatched tags keep the
  tag text (usually UPPERCASE) and omit `matched_overview_item` - fix the casing from the source
  wording if it is stated there.
- A reward that depends on a choice or a roll: put the condition in `condition`; do not duplicate
  it in more than one step.

## 5. Enemies and bosses

Copy these from canonical unchanged; QA compares them field by field.

`enemies[]`: `name` (required), `number`, `hp` (int or string), `class`, `is_boss`, `is_subboss`, `notes`.

Boss card (`bosses[]`, `boss`, or `steps[].boss`): required `name`, `type` (`BOSS` / `SUB-BOSS`
as in canonical).

| Key | Shape |
| :-- | :-- |
| `enemies` | `[{name (req), hp (int\|null), class, drop (string\|null)}]` |
| `party` | `[{name, level:int, equipment?: string[], fusions?: string[]}]`; `name`/`level` required. `equipment` = the box's gear rows (weapon, armor, accessories) in source order, `fusions` = the fusion rows; omit when the box lists none |
| `exp`, `cash` | integer or `null` |
| `strategy` | string; light list-formatting allowed, wording must stay faithful |

Every canonical boss must appear exactly once (in `bosses[]` or as a `step.boss`) and be
mapped to a step (by `step.boss`, or by name in `step.encounter.enemies`). Place the card in
the step where the fight happens; do not hoist boss tactics into overviews.

## 6. Text conventions

- `description`, `notes[].text`, boss `strategy`: **3+ sentences or ~40+ words => list.**
  `1. ` numbered only when order matters, `- ` bullets otherwise, one fact/action per item.
- Emphasise entities with `**bold**` (items, places, enemies, mechanics) and `` `CROSS` `` for buttons.
- No `[_TAG_]` marks, no ASCII-art borders.
- Do not rename, re-number or "correct" anything (`Margaret` vs `Margarete`, `Causal Belt` stay).

## 7. Choices and outcomes

```json
"choices": [
  { "option": "1. Yes, of course.", "outcome": "Allows you to see what items he has for sale." },
  { "option": "1. Not yet." }
]
```

- `option` (required): the option text as in the source, optionally prefixed `N. `.
  QA checks it appears in the source text.
- `outcome` (optional): **only if the source states the result** (e.g. "Choosing option 1 will
  allow you to see what items he has for sale."). Otherwise omit the key. Never infer. QA warns
  when an outcome's wording is not traceable to the source. Never use `""`.
- `reward` (optional string): when the source says that option gives an item.
- `prompt` (optional integer, 1-based): which prompt of a multi-prompt dialogue the option belongs to. Set it on every option when a step has 2+ prompts.
- `required` (optional boolean): `true` when the source marks the option as the required answer (e.g. an `>` arrow). The scaffold also adds an "Answer the first prompt with [1] ..." item to the description.
- Put the step `type` as `dialogue` when the choice is the point of the step.
- **Rendering:** the step shows `choices` grouped per `prompt`, with `required` options
  highlighted. The `description` should still say what the choice is (the source prose usually does).

## 8. Minimal step recipes

Loot with a missable warning:

```json
{
  "id": 6, "type": "loot",
  "description": "1. Equip the **Pocket Watch**; the ring moves fast here.\n2. Win the **Iron Clogs** before continuing.",
  "notes": [ { "type": "missable", "title": "Win the Iron Clogs", "text": "The source says to win them before continuing on." } ],
  "rewards": [ { "name": "Iron Clogs", "category": "equipment", "matched_overview_item": "Iron Clogs" } ]
}
```

Boss step:

```json
{
  "id": 9, "type": "boss",
  "description": "Watch a bit of dialogue, then take on a powered-up **Li Li**.",
  "encounter": { "enemies": ["Li Li"] },
  "boss": { "type": "BOSS", "name": "Li Li",
            "enemies": [ { "name": "Li Li", "hp": 720, "class": "Dark", "drop": "B.Tortoise Fang" } ],
            "party": [ { "name": "Yuri", "level": 14 } ], "exp": 1000, "cash": 3950, "strategy": "..." },
  "rewards": []
}
```

## 9. Workflow commands

```powershell
.\scripts\run-py.cmd scripts/pipeline.py <id> --scaffold          # draft from canonical (refuses to overwrite; --force to replace)
.\scripts\run-py.cmd scripts/patch_section.py <id> <patch.json>   # merge a JSON patch, re-validate, write only if valid
.\scripts\run-py.cmd scripts/pipeline.py <id> --validate          # schema only
.\scripts\run-py.cmd scripts/pipeline.py <id> --qa                # QA; findings printed, report in qa-reports/<id>.md
.\scripts\run-py.cmd scripts/pipeline.py <id> --check             # validate + QA + build + status
```

Patch files: see `scripts/patch_section.py` (objects merge, `null` deletes, an object keyed
by step id edits `steps` in place). Write the patch with the file Write tool, not a shell heredoc.
