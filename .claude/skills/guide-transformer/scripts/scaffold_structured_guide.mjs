// scaffold_structured_guide.mjs - Automated scaffolding for structured game guides.
//
// Takes a canonical section JSON file and generates a structured guide JSON draft:
// 1. Copies core metadata, enemies, bosses, shops, and navigation verbatim.
// 2. Compiles items_summary from overview items, equipment, valuables, and lottery.
// 3. Parses narrative text paragraphs and pre-associates canonical markers.items and markers.notes.
// 4. Detects choices and battle encounters.
// 5. Emits a valid structured guide draft ready for Guide Transformer refinement.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blocksFromMarkdown } from "./richtext.mjs";
import { PROJECT } from "../../../../scripts/project_config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..", "..");

// --- small Python-compatible helpers -----------------------------------------------------

/** " ".join(text.split()) */
const ws = (text) => String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
/** str.splitlines() (no trailing empty element). */
const splitLines = (text) => {
  const parts = String(text ?? "").split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
};
/** Python str.title(): every run of letters capitalised, the rest lowercase. */
const pyTitle = (s) => s.replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
/** Python str.capitalize() for one word. */
const pyCapitalize = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "");
const lstrip = (s) => s.replace(/^\s+/, "");
const rstripSpaces = (s) => s.replace(/ +$/, "");
const unique = (arr) => [...new Set(arr)];
const isDict = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const normName = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- overview items --------------------------------------------------------------------

/** Cleans an overview item name and checks if it was marked as initial (*). */
export function cleanOverviewItem(raw) {
  const isInitial = raw.includes("*");
  return [raw.replace(/\*/g, "").replace(/\[_\]/g, "").trim(), isInitial];
}

/** Extracts obtainable and initial item lists from canonical overview metadata. */
export function buildItemsSummary(canonical) {
  const overview = canonical.overview ?? {};
  const obtainable = [];
  const initial = [];
  const categories = ["items", "equipment", "valuables", "lottery", "souls"];
  for (const cat of categories) {
    for (const item of overview[cat] ?? []) {
      const [cleaned, isInit] = cleanOverviewItem(item);
      if (!cleaned || cleaned === "|") continue;
      if (isInit) initial.push({ name: cleaned, category: cat });
      else obtainable.push({ name: cleaned, category: cat, location: "" });
    }
  }
  const summary = { obtainable };
  if (initial.length) summary.initial = initial;
  return summary;
}

export function inferNoteType(title, text) {
  const t = `${title} ${text}`.toLowerCase();
  if (["impossible", "cannot be defeated", "tough", "dangerous", "remove", "missable", "warning", "beware"]
    .some((k) => t.includes(k))) return "warning";
  if (["mechanic", "how to", "tutorial", "skill"].some((k) => t.includes(k))) return "tutorial";
  return "tip";
}

// --- dialogue choices -------------------------------------------------------------------

const CHOICE_LINE = /^\s*(?<arrow>\S*>)?\s*\[(?<num>\d+)\]\s+(?<text>\S.*?)(?:\s+<\S*)?\s*$/;
const HAS_WORD = /[A-Za-z0-9]/;
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/**
 * Finds dialogue choice blocks: consecutive `[n] Option` lines, optionally framed by `>` ... `<`
 * arrows that mark the required answer. Returns [{ first, last, groups }] (1-indexed lines).
 * `outcome` is deliberately never set: the source states outcomes in prose.
 */
export function findChoiceBlocks(text) {
  const blocks = [];
  let groups = [];
  let first = 0;
  let last = 0;

  const close = () => {
    if (groups.length) blocks.push({ first, last, groups });
    groups = [];
  };

  splitLines(text).forEach((line, idx) => {
    const i = idx + 1;
    const m = CHOICE_LINE.exec(line);
    if (m) {
      const num = Number(m.groups.num);
      if (!groups.length) {
        first = i;
        groups.push([]);
      } else if (num <= groups[groups.length - 1][groups[groups.length - 1].length - 1].num) {
        groups.push([]);
      }
      groups[groups.length - 1].push({ num, text: m.groups.text, marked: Boolean(m.groups.arrow) });
      last = i;
    } else if (groups.length && !HAS_WORD.test(line)) {
      // rule line / blank inside a block
    } else if (groups.length) {
      close();
    }
  });
  close();
  return blocks;
}

/** Schema `choices[]` for a block: every option verbatim, tagged with its prompt and required mark. */
export function choiceEntries(block) {
  const multi = block.groups.length > 1;
  const entries = [];
  block.groups.forEach((group, gi0) => {
    for (const opt of group) {
      const entry = { option: `${opt.num}. ${opt.text}` };
      if (multi) entry.prompt = gi0 + 1;
      if (opt.marked) entry.required = true;
      entries.push(entry);
    }
  });
  return entries;
}

/** One sentence per marked option: "Answer the first prompt with [1] Option". */
export function requiredAnswers(block) {
  const multi = block.groups.length > 1;
  const lines = [];
  block.groups.forEach((group, gi0) => {
    const gi = gi0 + 1;
    const which = multi ? ` the ${gi <= ORDINALS.length ? ORDINALS[gi - 1] : gi} prompt` : "";
    for (const o of group) {
      if (o.marked) {
        let body = `[${o.num}] ${o.text}`;
        if (!/[.!?…]$/.test(body)) body += ".";
        lines.push(`Answer${which} with ${body}`);
      }
    }
  });
  return lines;
}

// --- ASCII info boxes (lottery prize table, footnote, boss card) ------------------------

const LOTTERY_ROW = /\(([^)]+)\)\s*\|\s*(.*?)\s*[\/\\]*\s*$/;
const LOTTERY_TITLE = /\[_([^_]+)_\]/;
const FOOTNOTE_START = /^\s{0,4}\*\s+-\s+(\S.*)$/;
const CARD_TAG = /\*+\s*(SUB-BOSS|BOSS)\s*\*+/;
const CARD_ROW = /^\|\s*(.+?)\s*\|\s*(\d+\s*HP|HP\s+Varies)\s*\|\s*Class:\s*(\w+)\s*\|\s*(?:\[_\]\s*)?(.*?)\s*\|\s*$/;
const CARD_EXPCASH = /(\d+)\s*EXP\s*\/.*?(\d+)\s*Cash/;
const SIDE_BY_SIDE_HEAD = /^\s*\|\s*([^|=]*[A-Za-z][^|=]*?)\s*\|\s*([^|=]*[A-Za-z][^|=]*?)\s*\|[^|]{0,6}\|\s*\1\s*\|\s*\2\s*\|\s*$/;
const SIDE_BY_SIDE_ROW = /^\s*\|\s*([^|=]*?)\s*\|\s*([^|=]*?)\s*\|[^|]{0,6}\|\s*([^|=]*?)\s*\|\s*([^|=]*?)\s*\|\s*$/;

/** Locates info boxes in the source text. kinds: lottery, table, footnote, boss_card (1-indexed lines). */
function findBoxes(lines) {
  const boxes = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    // Lottery member prize table: starts with the `\$$$$ ... $$$$/` banner, ends at the rule.
    if (/^\s*_{20,}\s*$/.test(line) && i + 1 < n && /^\s*\\\$\$\$\$/.test(lines[i + 1])) {
      let j = i + 1;
      let title = "";
      const rows = [];
      while (j < n && lines[j].trim()) {
        const tm = LOTTERY_TITLE.exec(lines[j]);
        if (tm && !title) title = tm[1];
        const rm = LOTTERY_ROW.exec(lines[j]);
        if (rm) rows.push({ range: rm[1].trim(), reward: rm[2].trim() });
        j++;
      }
      boxes.push({ kind: "lottery", start: i + 1, end: j, data: { title, rows } });
      i = j;
      continue;
    }
    // Side-by-side two-column table: `| A | B |xx| A | B |` header, rows read left half then right half.
    const hm = SIDE_BY_SIDE_HEAD.exec(line);
    if (hm) {
      let j = i + 1;
      while (j < n && (SIDE_BY_SIDE_ROW.test(lines[j]) || /^\s*\|\s*=/.test(lines[j]))) j++;
      const left = [];
      const right = [];
      for (let k = i + 1; k < j; k++) {
        if (/^\s*\|\s*=/.test(lines[k])) continue; // `|===|===|` separator row
        const rm = SIDE_BY_SIDE_ROW.exec(lines[k]);
        const [a, b, c, d] = rm.slice(1, 5).map((g) => g.trim());
        left.push({ range: a, reward: b });
        right.push({ range: c, reward: d });
      }
      if (left.length) {
        const start = i > 0 && lstrip(lines[i - 1]).startsWith(".") ? i - 1 : i;
        const end = j < n && lstrip(lines[j]).startsWith("'") ? j + 1 : j;
        boxes.push({
          kind: "table", start: start + 1, end,
          data: { headers: [hm[1].trim(), hm[2].trim()], rows: [...left, ...right] },
        });
        i = end;
        continue;
      }
    }
    // Footnote: "* - text" followed by indented continuation lines.
    const fm = FOOTNOTE_START.exec(line);
    if (fm) {
      const parts = [fm[1].trim()];
      let j = i + 1;
      while (j < n && lines[j].trim() && lines[j].startsWith("   ")) {
        parts.push(lines[j].trim());
        j++;
      }
      boxes.push({ kind: "footnote", start: i + 1, end: j, data: { text: parts.join(" ") } });
      i = j;
      continue;
    }
    // Boss card: `.———.` / `/ * SUB-BOSS * \` ... down to the EXP/Cash tail.
    const cm = CARD_TAG.exec(line);
    if (cm && i + 1 < n && lstrip(lines[i + 1]).startsWith(".")) {
      const start = i > 0 && lines[i - 1].trim().startsWith(".") ? i - 1 : i;
      let j = i + 1;
      const enemies = [];
      const strat = [];
      let tail = null;
      while (j < n && lines[j].trim()) {
        const row = CARD_ROW.exec(lines[j].trim());
        if (row) {
          const hp = /^\d+/.exec(row[2]);
          enemies.push({
            name: row[1],
            hp: hp ? Number(hp[0]) : null,
            class: row[3],
            drop: row[4] || null,
          });
        } else {
          const sm = /^\|\s{2}(\S.*?)\s*\|\s*$/.exec(lines[j].trim());
          if (sm && !/^[.|='—\s]+$/.test(sm[1])) strat.push(sm[1]);
          const em = lines[j].trim().startsWith("\\") ? CARD_EXPCASH.exec(lines[j]) : null;
          if (em) tail = [Number(em[1]), Number(em[2])];
        }
        j++;
      }
      const card = {
        type: cm[1],
        name: enemies.map((e) => e.name).join(", "), // as the importer joins them
        enemies,
      };
      if (tail) {
        card.exp = tail[0];
        card.cash = tail[1];
      }
      card.strategy = strategySentences(strat).map((s) => `- ${s}`).join("\n");
      boxes.push({ kind: "boss_card", start: start + 1, end: j, data: card });
      i = j;
      continue;
    }
    i++;
  }
  return boxes;
}

/** Re-joins the card's wrapped strategy lines and splits them into one sentence per item. */
function strategySentences(rows) {
  return splitSentences(stripBoxChars(rows.filter(Boolean).join(" ")));
}

function blankBoxes(lines, boxes) {
  const out = [...lines];
  for (const b of boxes) {
    for (let ln = b.start; ln <= b.end; ln++) out[ln - 1] = "";
  }
  return out;
}

let globalNames = null;

/** Properly-cased item names from every canonical section (overview, shops, boss drops). */
function globalNameIndex() {
  if (globalNames === null) {
    const votes = new Map();
    const dir = join(REPO_ROOT, "canonical-sources", "sections");
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    for (const f of files) {
      let d;
      try {
        d = JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch {
        continue;
      }
      for (const n of sectionNames(d)) {
        const key = normName(n);
        if (!votes.has(key)) votes.set(key, new Map());
        const counts = votes.get(key);
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    globalNames = new Map();
    for (const [key, counts] of votes) {
      // most common casing; ties keep the first one seen (Counter.most_common order)
      let best = null;
      let bestN = -1;
      for (const [name, c] of counts) {
        if (c > bestN) {
          best = name;
          bestN = c;
        }
      }
      globalNames.set(key, best);
    }
  }
  return globalNames;
}

function sectionNames(canonical) {
  const names = [];
  for (const cat of ["items", "equipment", "valuables", "lottery", "souls"]) {
    for (const raw of canonical.overview?.[cat] ?? []) {
      const [c] = cleanOverviewItem(raw);
      if (c && c !== "|") names.push(c);
    }
  }
  for (const shop of canonical.shops ?? []) {
    for (const i of shop.inventory ?? []) if (i.name) names.push(i.name);
  }
  for (const b of canonical.bosses ?? []) {
    for (const e of b.enemies ?? []) if (e.drop) names.push(e.drop);
  }
  return names;
}

/** normalized-name -> properly-cased name: this section's overview/shops first, then project-wide. */
function buildNameCases(canonical) {
  const cases = new Map(globalNameIndex());
  for (const n of sectionNames(canonical)) cases.set(normName(n), n);
  return cases;
}

/** Replaces `[_TAG_]` with the properly-cased item name when one is known (else the tag text). */
export function fixTagCase(text, cases, bold = false) {
  return text.replace(/\[_([^_]+)_\]/g, (_, raw) => {
    const name = cases.get(normName(raw)) ?? raw;
    return bold ? `**${name}**` : name;
  });
}

// --- NOTE boxes ------------------------------------------------------------------------

const NOTE_START = /^\s*NOTE\s{2,}(\S.*)$/;
const NOTE_CONT = /^\s*(?:¯+\s+|\s{6,})(\S.*)$/;

/** Reads NOTE boxes straight from the source text: [{ line, end, text }] (1-indexed). */
function parseNoteBoxes(lines) {
  const boxes = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const m = NOTE_START.exec(lines[i]);
    if (!m) {
      i++;
      continue;
    }
    const parts = [m[1].trim()];
    let j = i + 1;
    let last = i + 1;
    while (j < n) {
      const line = lines[j];
      if (!line.trim()) {
        j++;
        continue;
      }
      const cm = NOTE_CONT.exec(line);
      const indented = /^\s{8,}[^\s.'/|]/.test(line);
      if (NOTE_START.test(line) || line.includes("|") || !(cm || (indented && j > last))) break;
      parts.push((cm ? cm[1] : line).trim());
      j++;
      last = j;
    }
    boxes.push({ line: i + 1, end: last, text: parts.join(" ") });
    i = last;
  }
  return boxes;
}

/**
 * Canonical note markers plus the NOTE boxes the canonical import dropped.
 * Returns [{ line, end, type, text }] sorted by source line.
 */
function buildNotes(markersNotes, lines) {
  const boxes = new Map(parseNoteBoxes(lines).map((b) => [b.line, b]));
  const notes = new Map();
  for (const mn of markersNotes) {
    const ln = mn.line ?? 0;
    const text = (mn.text ?? "").split(/\s+NOTE\s{3,}/)[0];
    notes.set(ln, { line: ln, end: boxes.get(ln)?.end ?? ln, type: mn.type ?? "Note", text });
  }
  for (const [ln, box] of boxes) {
    if (!notes.has(ln)) notes.set(ln, { line: ln, end: box.end, type: "NOTE", text: box.text });
  }
  return [...notes.keys()].sort((a, b) => a - b).map((k) => notes.get(k));
}

// --- text normalization ----------------------------------------------------------------

const CAMEL_WORD = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;
const CAMEL_EXCEPTIONS = new Set(["PlayStation"]);
const SMALL_WORDS = new Set(["Of", "The"]);

/** "TalismanOfLuck" -> "Talisman of Luck" (same rule as spaceCamelCase in src/lib/markup.ts). */
export function spaceCamelCase(text) {
  if (typeof text !== "string" || !text) return text;
  return text.replace(CAMEL_WORD, (word) => {
    if (CAMEL_EXCEPTIONS.has(word)) return word;
    return [...word.matchAll(/[A-Z][a-z]+/g)]
      .map((m) => (SMALL_WORDS.has(m[0]) ? m[0].toLowerCase() : m[0]))
      .join(" ");
  });
}

/** Spaces CamelCase item names in items_summary, shop inventories, rewards and boss drops/gear. */
function normalizeItemNames(guide) {
  const summary = guide.items_summary ?? {};
  for (const key of ["obtainable", "initial"]) {
    for (const it of summary[key] ?? []) it.name = spaceCamelCase(it.name);
  }
  for (const shop of guide.shops ?? []) {
    for (const inv of shop.inventory ?? []) inv.name = spaceCamelCase(inv.name);
  }
  for (const it of summary.obtainable ?? []) it.location = spaceCamelCase(it.location);
  for (const st of guide.steps ?? []) {
    st.description = spaceCamelCase(st.description);
    for (const note of st.notes ?? []) {
      note.text = spaceCamelCase(note.text);
      const table = note.table;
      if (isDict(table)) {
        table.headers = (table.headers ?? []).map(spaceCamelCase);
        for (const row of table.rows ?? []) {
          for (const k of Object.keys(row)) row[k] = spaceCamelCase(row[k]);
        }
      }
    }
    for (const r of st.rewards ?? []) {
      r.name = spaceCamelCase(r.name);
      if (r.matched_overview_item) r.matched_overview_item = spaceCamelCase(r.matched_overview_item);
    }
  }
  const cards = [...(guide.bosses ?? [])];
  for (const st of guide.steps ?? []) if (isDict(st.boss)) cards.push(st.boss);
  for (const card of cards) {
    for (const e of card.enemies ?? []) {
      if (e.drop) e.drop = spaceCamelCase(e.drop);
    }
    for (const member of card.party ?? []) {
      if (Array.isArray(member.equipment)) member.equipment = member.equipment.map(spaceCamelCase);
    }
  }
}

const BOX_CHARS = /\s*\|+\s*/g;
const CAPS_RUN = /\b[A-Z][A-Z'’]+(?:\s+[A-Z][A-Z'’]+)*\b/g;
const CAPS_KEEP = new Set(["EXP", "HP", "MP", "SP", "NOTE", "BOSS", "SUB-BOSS", "ATK", "DEF", "OK", "TV", "NPC", "VS"]);

/** Removes ASCII-box border characters that leaked into wrapped text. */
export function stripBoxChars(text) {
  return ws(text.replace(BOX_CHARS, " "));
}

/** SHOUTED multi-word emphasis -> bold lowercase ("MAKE SURE TO SAVE" -> "**Make sure to save**"). */
export function softenCaps(text) {
  return text.replace(CAPS_RUN, (run, offset) => {
    const letters = run.replace(/[^A-Z]/g, "");
    const words = run.split(" ");
    if (letters.length < (run.includes(" ") ? 6 : 4) || CAPS_KEEP.has(run) || words.every((w) => CAPS_KEEP.has(w))) {
      return run;
    }
    // Acronyms inside the run keep their casing ("EXP AND" -> "EXP and", not "exp and").
    let low = words.map((w) => (CAPS_KEEP.has(w) ? w : w.toLowerCase())).join(" ");
    const before = text.slice(0, offset).replace(/\s+$/, "");
    if ((!before || '.!?:"“'.includes(before.slice(-1))) && !/^[A-Z]/.test(low)) {
      low = low.charAt(0).toUpperCase() + low.slice(1);
    }
    return `**${low}**`;
  });
}

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|St|vs|No)\.(?=\s)|\b[A-Z]\.(?=\s+[A-Z][a-z])/g;
const SENT_SPLIT = /(?<=[.!?])["')\]*]*\s+(?=["'(\[*]*[A-Z0-9])/;
const BOLD_SPAN = /\*\*.+?\*\*/g;
const LIST_LINE_M = /^\s*(?:[-*]|\d+\.)\s/m;
const MAX_SENTENCES = 2; // same thresholds as lint_guide: 3+ sentences or ~40+ words => list
const MAX_WORDS = 39;

/** One entry per sentence (abbreviations like "Mr." do not end one). Text is not reworded. */
export function splitSentences(text) {
  const flat = ws(text);
  const guarded = flat.replace(ABBREV, (m) => `${m.slice(0, -1)}\x00`);
  return guarded.split(SENT_SPLIT).map((s) => s.replace(/\x00/g, ".").trim()).filter((s) => s.trim());
}

const OPTION_PARA = /^\d+[.)]\s/;

/** Boss-box strategy -> one item per sentence, cut along the box's blank-line paragraphs. */
export function reflowStrategy(text) {
  if (LIST_LINE_M.test(text) && !text.includes("\n\n")) return text;
  const items = [];
  for (const para of text.split(/\n\s*\n/)) {
    const flat = ws(para);
    if (!flat) continue;
    items.push(...(OPTION_PARA.test(flat) ? [flat] : splitSentences(flat)));
  }
  if (items.length <= 1) return items.join(" ");
  return items.map((i) => `- ${i}`).join("\n");
}

/** Splits prose with 3+ sentences or ~40+ words into one sentence per list item. */
export function listify(text, numbered) {
  if (text.includes("\n") && LIST_LINE_M.test(text)) return text;
  const flat = ws(text);
  const sentences = splitSentences(text);
  if (sentences.length < 2 || (sentences.length <= MAX_SENTENCES && flat.split(" ").length <= MAX_WORDS)) {
    return flat;
  }
  return sentences.map((s, i) => (numbered ? `${i + 1}. ${s}` : `- ${s}`)).join("\n");
}

/** Bolds known character names outside existing **bold** spans. */
export function boldNames(text, names) {
  if (!names.length) return text;
  const alt = [...names].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  const pattern = new RegExp(`\\b(${alt})\\b`, "g");
  const out = [];
  let pos = 0;
  for (const m of text.matchAll(BOLD_SPAN)) {
    out.push(text.slice(pos, m.index).replace(pattern, "**$1**"));
    out.push(m[0]);
    pos = m.index + m[0].length;
  }
  out.push(text.slice(pos).replace(pattern, "**$1**"));
  return out.join("");
}

/** Playable-character names, taken from the project's own boss `party` lists. */
function partyNames(canonical) {
  const names = new Set();
  const dir = join(REPO_ROOT, "canonical-sources", "sections");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    let d;
    try {
      d = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      continue;
    }
    for (const b of d.bosses ?? []) for (const m of b.party ?? []) if (m.name) names.add(m.name);
  }
  for (const b of canonical.bosses ?? []) for (const m of b.party ?? []) if (m.name) names.add(m.name);
  return [...names].filter((n) => n && n.length > 2).sort();
}

// `[W-S-01] Yuri's Level 1 Fusions` on a hub page: a code, then a title (which may wrap)
const TEASER_HEADER = /^\s*\[[A-Z]-[A-Z0-9-]+\]\s+\S/;

function isHeaderOrTableLine(line) {
  const s = line.trim();
  if (!s) return false;
  if (!HAS_WORD.test(s)) return true; // ASCII divider: never content
  if (s.includes("|")) return true;
  if (["___", "===", "---", "¯¯¯", ".——", "'——", "——", "\\", "/", "-$-"].some((p) => s.startsWith(p))) return true;
  // Table labels sit at the left margin; an indented line or one that ends a sentence is wrapped prose.
  const indentedProse = (line.length - lstrip(line).length) >= 8 || /[.!?]$/.test(s);
  if (!indentedProse && /^(?:#\d{3}|Enemy|Save Points|Items|Equipment|Valuables|Souls|Cash|Lottery)\b/.test(s)) {
    return true;
  }
  if (TEASER_HEADER.test(s) && !s.includes("|")) return false; // hub teaser: content
  if (/^(?:Shadow Hearts|\[[A-Z0-9-]+\])/.test(s)) return true;
  return false;
}

/** Splits text into paragraphs: [start_line, end_line, text] (1-indexed lines). */
function splitTextParagraphs(text) {
  const raw = splitLines(text);
  const lines = blankBoxes(raw, findBoxes(raw));
  const paragraphs = [];
  let current = [];
  let startLine = 0;

  const flush = (endLine) => {
    const pText = current.join("\n").trim();
    if (pText) paragraphs.push([startLine, endLine, pText]);
    current = [];
    startLine = 0;
  };

  lines.forEach((line, idx) => {
    const i = idx + 1;
    if (isHeaderOrTableLine(line)) {
      if (current.length) flush(i - 1);
      return;
    }
    if (!line.trim()) {
      if (current.length) flush(i - 1);
    } else {
      if (!current.length) startLine = i;
      current.push(line);
    }
  });
  if (current.length) flush(lines.length);
  return mergeBrokenSentences(paragraphs);
}

const NOTE_GAP = 4; // max lines between a paragraph's end and a NOTE box attached to it
const SENTENCE_END = [".", "!", "?", '"', "'", ")", "]", ":", "”"];

const isNoteParagraph = (p) => lstrip(p).startsWith("NOTE");
const endsSentence = (p) => SENTENCE_END.some((c) => rstrip(p).endsWith(c));
const rstrip = (s) => s.replace(/\s+$/, "");
/** Python str.islower() for the first character. */
const isLowerStart = (text) => {
  const c = text.charAt(0);
  return c !== "" && c === c.toLowerCase() && c !== c.toUpperCase();
};

/** Rejoins a sentence split by an interleaved table/ASCII-art block or stray blank line. */
function mergeBrokenSentences(paragraphs) {
  const merged = [];
  for (const [start, end, text] of paragraphs) {
    if (merged.length) {
      const [pStart, , pText] = merged[merged.length - 1];
      if (!isNoteParagraph(pText) && !isNoteParagraph(text) && !endsSentence(pText) && isLowerStart(text)) {
        merged[merged.length - 1] = [pStart, end, `${pText}\n${text}`];
        continue;
      }
    }
    merged.push([start, end, text]);
  }
  return merged;
}

/** Short title-like line (e.g. 'Sewers') with no sentence punctuation. */
function isHeadingParagraph(p) {
  const s = p.trim();
  return !s.includes("\n") && s.split(/\s+/).length <= 4 && !SENTENCE_END.some((c) => s.endsWith(c));
}

/** Strips [_TAG_] marks and trailing ASCII-art tables from a note. */
function cleanNoteText(text) {
  let t = text.trim().replace(/\[_([^_]+)_\]/g, "$1");
  t = t.split(/\s_{5,}|\s\\[$/]/)[0];
  return softenCaps(t.trim());
}

/** A structured note from a canonical note marker: tags cased + bolded, long prose as a list. */
function makeNote(mn, cases, characters) {
  const title = pyTitle(mn.type ?? "Note");
  let text = cleanNoteText(fixTagCase(mn.text ?? "", cases, true));
  text = listify(boldNames(text, characters), false);
  return { type: inferNoteType(title, text), title, text, _line: mn.line ?? 0 };
}

function isReferenceSection(canonical) {
  const id = canonical.id ?? "";
  return id.startsWith("a-1-") && id !== "a-1-00";
}

/** Deterministic scaffold: canonical text is carried over byte-for-byte, no steps or prose. */
function scaffoldReferenceGuide(canonical) {
  const source = canonical.source ?? {};
  const guide = {
    id: canonical.id,
    code: canonical.code,
    title: canonical.title,
    type: "reference",
    category: canonical.category,
    source: {
      game: source.game ?? PROJECT.game,
      author: source.author ?? PROJECT.sourceDefaults.author,
      version: source.version ?? PROJECT.sourceDefaults.version,
      url: source.source_url ?? "",
      source_file: source.source_file ?? "",
    },
    navigation: canonical.navigation ?? {},
    enemies: canonical.enemies ?? [],
    bosses: canonical.bosses ?? [],
    shops: canonical.shops ?? [],
    reference_blocks: [{ format: "preformatted", text: canonical.text ?? "" }],
  };
  if (canonical.boss) guide.boss = canonical.boss;
  return { guide };
}

const FIGHT_CUE = /\b(fight|battle|combat|take on|face|defeat|boss)\b/i;
const PREP_CUE = /\b(prepared|prepare|ready|before)\b/i;
const SHOP_CUE = /\b(for sale|shop|store|buy|buying|purchase|sells?)\b/i;
const STORY_CUE = /\b(scene|event|watch|cutscene|dialogue)\b/i;
const AFTER_BATTLE = /^\s*after the (?:battle|fight)\b/i;
const BEAT_CUE = /\b(dialogue|events?|scene|cutscene|watch|conversation|reunite)\b/i;
const MINIGAME_CUE = /\b(play a game|mini-?game|contest|pay (?:him|her|them|it)\b)/i;
const MEANWHILE_CUE = /^\s*meanwhile\b/i;
const NAV_CUE = /^(head|go|make your way|travel|exit|leave|return|walk|proceed)\b/i;
const AFTER_FIGHT_PHRASE = /\bafter (?:the|that|this) (?:battle|fight)\b/i;
const SEQ_CUE = /\b(first|then|next|after that|afterwards?|finally)\b/i;
const XREF_CUE = /\b(side quests?|next|before|after|do that|head to|go to)\b/i;
const INTERSTITIAL = /^\s*meanwhile\b/i;
const BULLET_LINE = /^\s*[-*]\s+(\S.*)$/;
const CHOICE_TAIL_GAP = 3; // max lines between a choice block and the text that continues it

/** Maps a paragraph to a schema `type` (see docs/structured-schema.md). Conservative on purpose. */
export function inferStepType(pText, bosses, hasRewards, hasChoices, hasEncounter = false) {
  if (hasChoices) return "dialogue";
  if (TEASER_HEADER.test(pText)) return "quest"; // hub teaser pointing at a side-quest section
  const namedBoss = bosses.some((b) => b.name && new RegExp(`\\b${escapeRe(b.name)}\\b`, "i").test(pText));
  if (namedBoss && FIGHT_CUE.test(pText)) return "boss";
  if (/\bboss\b/i.test(pText) && PREP_CUE.test(pText)) return "preparation";
  // "After the battle ... dialogue / events": the fight is over, this is a story beat.
  if (AFTER_BATTLE.test(pText) && BEAT_CUE.test(pText)) return "story";
  // Items tagged in the text make it a loot step; "shop" only when buying is the point.
  if (SHOP_CUE.test(pText) && !hasRewards) return "shop";
  // Item rewards, no enemy named, and "battle" only as "after the battle": a loot step.
  if (hasRewards && !hasEncounter
      && !/\b(battle|fight|combat)\b/i.test(pText.replace(AFTER_FIGHT_PHRASE, ""))) {
    return "loot";
  }
  if (/\b(battle|fight|combat)\b/i.test(pText)) {
    // No known enemy in the text: the word is incidental ("avoid the battle"), not a fight step.
    return hasEncounter ? "battle" : "exploration";
  }
  if (hasRewards) return "loot";
  if (MINIGAME_CUE.test(pText)) return "quest";
  if (STORY_CUE.test(pText) || MEANWHILE_CUE.test(pText)) return "story";
  if (NAV_CUE.test(pText.trim())) return "navigation";
  return "exploration";
}

/** Bolds `[CODE] Title` of the prev/next section in step text (exact match only). */
function boldNavRefs(steps, navigation) {
  for (const key of ["prev", "next"]) {
    const entry = navigation[key] ?? {};
    const { code, title } = entry;
    if (!code || !title) continue;
    const ref = `${code} ${title}`;
    // `[CODE] Title` as written, or the bare title when the source names the section without its code
    const pattern = new RegExp(`(?<![*\\w])(?:${escapeRe(code)}\\s+)?${escapeRe(title)}(?![*\\w])`, "g");
    for (const st of steps) {
      const desc = st.description ?? "";
      if (!new RegExp(pattern.source).test(desc)) continue;
      // a bare title is only a cross-reference when the step points onward ("next side quest")
      const full = new RegExp(`${escapeRe(code)}\\s+${escapeRe(title)}`).test(desc);
      if (!full && !XREF_CUE.test(desc)) continue;
      st.description = desc.replace(pattern, () => `**${ref}**`);
      if (code.toUpperCase().startsWith("[W-S-") && /side quest/i.test(desc)
          && ["exploration", "battle", "navigation"].includes(st.type)) {
        st.type = "quest";
      }
    }
  }
}

/** First sentence of a step description that mentions `name` (case-insensitive), else "". */
function sentenceWith(description, name) {
  const needle = String(name ?? "").replace(/^[() ]+|[() ]+$/g, "").toLowerCase();
  if (!needle) return "";
  for (let sent of ws(description).split(/(?<=[.!?])\s+/)) {
    if (sent.toLowerCase().includes(needle)) {
      sent = sent.trim().replace(/^(?:\d+\.|[-*])\s*/, "").replace(/\*\*/g, "");
      return sent.replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, "$1");
    }
  }
  return "";
}

/** Fills obtainable[].location with the verbatim source sentence + "(step N)" where the item appears. */
function fillItemLocations(itemsSummary, steps) {
  const norm = (n) => String(n ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Steps that award each item, in order; the k-th overview entry of a name takes the k-th step.
  const rewardSteps = new Map();
  for (const st of steps) {
    const seen = new Set();
    for (const r of st.rewards ?? []) {
      const key = norm(r.matched_overview_item || r.name || "");
      if (!seen.has(key)) {
        seen.add(key);
        if (!rewardSteps.has(key)) rewardSteps.set(key, []);
        rewardSteps.get(key).push(st);
      }
    }
  }
  const occurrence = new Map();
  for (const item of itemsSummary.obtainable ?? []) {
    const key = norm(item.name);
    const k = occurrence.get(key) ?? 0;
    occurrence.set(key, k + 1);
    const candidates = [];
    const rs = rewardSteps.get(key) ?? [];
    if (k < rs.length) candidates.push(rs[k]);
    candidates.push(...steps);
    for (const st of candidates) {
      const sent = sentenceWith(st.description, item.name);
      if (sent) {
        item.location = `${sent} (step ${st.id})`;
        break;
      }
    }
  }
}

const titleCaseTag = (raw) => raw.split(/\s+/).filter(Boolean).map(pyCapitalize).join(" ");

/** Attaches lottery tables, footnotes and boss cards to the step whose paragraph precedes them. */
function attachBoxes(boxes, paragraphs, paraStep, steps, canonical, cases, characters = []) {
  for (const b of boxes) {
    const owner = paragraphs.map((p, i) => [p, i]).filter(([p, i]) => p[0] <= b.start && paraStep.has(i))
      .map(([, i]) => i);
    let step;
    if (owner.length) step = paraStep.get(owner[owner.length - 1]);
    else if (steps.length) step = steps[0];
    else continue;

    const data = b.data;
    const addNote = (note) => {
      if (!step.notes) step.notes = [];
      step.notes.push(note);
    };
    if (b.kind === "lottery") {
      const recase = (r) => {
        const star = r.startsWith("*") ? "*" : "";
        const body = r.slice(star.length);
        return star + (cases.get(normName(body)) ?? body);
      };
      const title = titleCaseTag(data.title) || "Lottery";
      addNote({
        type: "tip",
        title: `${title} Prizes`,
        text: `Prize listing for ${title}, by color.`,
        table: {
          headers: ["Color", "Prize"],
          rows: data.rows.map((r) => ({ range: r.range, reward: recase(r.reward) })),
        },
      });
    } else if (b.kind === "table") {
      addNote({
        type: "tip",
        title: `${data.headers[0]} ${data.headers[1]} Table`,
        text: "Source shows two side-by-side columns; left column first, then right column.",
        table: {
          headers: data.headers,
          rows: data.rows.map((r) => ({ range: r.range, reward: cases.get(normName(r.reward)) ?? r.reward })),
        },
      });
    } else if (b.kind === "footnote") {
      const text = fixTagCase(data.text, cases);
      const kind = /\b(however|instead|actually)\b/i.test(text) ? "discrepancy" : "tip";
      addNote({ type: kind, title: "Footnote", text });
    } else if (b.kind === "boss_card" && data.name) {
      const cands = (canonical.bosses ?? []).filter((cb) => (cb.name ?? "").toLowerCase() === data.name.toLowerCase());
      const canon = cands.find((cb) => cb.type === data.type) ?? cands[0] ?? null;
      if (canon !== null) {
        const card = structuredClone(canon);
        const strategy = (card.strategy ?? "").split(/\r?\n/).map(stripBoxChars).join("\n");
        card.strategy = reflowStrategy(boldNames(strategy, characters));
        step.boss = card;
        if (["battle", "exploration", "story", "preparation", "loot"].includes(step.type)) step.type = "boss";
        continue;
      }
      const card = { ...data };
      card.enemies = data.enemies.map((e) => ({
        ...e,
        drop: e.drop ? (cases.get(normName(e.drop)) ?? e.drop) : null,
      }));
      card.strategy = softenCaps(fixTagCase(card.strategy ?? "", cases));
      step.boss = card;
      if (["battle", "exploration", "story", "preparation"].includes(step.type)) step.type = "boss";
    }
  }
}

/** Merges the paragraph that follows a lottery table / footnote into the one before it. */
function mergeAcrossInfoBoxes(paragraphs, boxes) {
  const info = boxes.filter((b) => b.kind === "lottery" || b.kind === "footnote").sort((a, b) => a.start - b.start);
  const clusters = [];
  for (const b of info) {
    if (clusters.length && b.start - clusters[clusters.length - 1][1] <= 3) {
      clusters[clusters.length - 1] = [clusters[clusters.length - 1][0], Math.max(clusters[clusters.length - 1][1], b.end)];
    } else {
      clusters.push([b.start, b.end]);
    }
  }
  const result = [...paragraphs];
  for (const [cStart, cEnd] of clusters) {
    let prev = null;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i][1] < cStart) {
        prev = i;
        break;
      }
    }
    const nxt = result.findIndex((p) => p[0] > cEnd);
    const nextIdx = nxt < 0 ? null : nxt;
    if (prev === null || nextIdx === null || result[nextIdx][0] - cEnd > 3) continue;
    if (isNoteParagraph(result[prev][2]) || isNoteParagraph(result[nextIdx][2])) continue;
    const [pStart, , pText] = result[prev];
    const [, nEnd, nText] = result[nextIdx];
    result[prev] = [pStart, nEnd, `${pText}\n${nText}`];
    result.splice(nextIdx, 1);
  }
  return result;
}

/** A one-line scene lead-in ("Meanwhile, in Kuihai Tower...") that belongs with what follows. */
function isInterstitial(text) {
  const s = text.trim();
  return !s.includes("\n") && s.split(/\s+/).length <= 8 && (INTERSTITIAL.test(s) || s.endsWith("...") || s.endsWith("…"));
}

/** Folds fragments into the step they belong to; returns [paragraphs, extras by start line]. */
function foldParagraphs(paragraphs, blocks) {
  const out = [];
  let pending = "";
  let pendingStart = 0;
  for (let [start, end, text] of paragraphs) {
    if (!pending && isInterstitial(text) && !isNoteParagraph(text)) {
      pending = text.trim();
      pendingStart = start;
      continue;
    }
    if (pending) {
      text = `${pending}\n${text}`;
      start = pendingStart;
      pending = "";
    }
    const lines = splitLines(text).filter((ln) => ln.trim());
    if (out.length && lines.length && lines.every((ln) => BULLET_LINE.test(ln))) {
      const [pStart, , pText] = out[out.length - 1];
      out[out.length - 1] = [pStart, end, `${pText}\n${text}`];
      continue;
    }
    out.push([start, end, text]);
  }
  if (pending) out.push([pendingStart, pendingStart, pending]); // nothing follows it: keep it on its own

  const extras = new Map();
  for (const block of blocks) {
    let owner = null;
    out.forEach((p, i) => {
      if (p[1] < block.first) owner = i;
    });
    if (owner === null) continue;
    const [start, end, text] = out[owner];
    if (!extras.has(start)) extras.set(start, { blocks: [], tail: "" });
    const info = extras.get(start);
    info.blocks.push(block);
    const nxt = owner + 1;
    if (nxt < out.length && out[nxt][0] - block.last > 0 && out[nxt][0] - block.last <= CHOICE_TAIL_GAP
        && !isNoteParagraph(out[nxt][2])) {
      const [, nEnd, nText] = out.splice(nxt, 1)[0];
      info.tail = `${info.tail}\n${nText}`.trim();
      out[owner] = [start, nEnd, text];
    }
  }
  return [out, extras];
}

/** Separates prose lines from `- ` bullets, re-joining each bullet's wrapped lines. */
function splitBullets(lines) {
  const prose = [];
  const bullets = [];
  let markerIndent = -1;
  let openIndents = [];
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const indent = ln.length - lstrip(ln).length;
    const m = BULLET_LINE.exec(ln);
    if (m) {
      while (openIndents.length && openIndents[openIndents.length - 1] > indent) openIndents.pop();
      if (!openIndents.length || openIndents[openIndents.length - 1] < indent) openIndents.push(indent);
      const level = Math.min(openIndents.length - 1, 2);
      bullets.push("  ".repeat(level) + m[1].trim());
      markerIndent = indent;
    } else if (bullets.length && indent > markerIndent && markerIndent >= 0) {
      bullets[bullets.length - 1] += " " + ln.trim();
    } else {
      prose.push(ln.trim());
      markerIndent = -1;
      openIndents = [];
    }
  }
  return [prose, bullets];
}

/** Hub teaser (`[W-S-01] Title` + bullets): bold title, one sentence per bullet, source order. */
function teaserDescription(lines, clean) {
  const title = [lines[0].trim()];
  let i = 1;
  while (i < lines.length && lines[i].trim() && !BULLET_LINE.test(lines[i])) {
    title.push(lines[i].trim()); // wrapped title
    i++;
  }
  const [, bullets] = splitBullets(lines.slice(i));
  const out = [`**${title.join(" ")}**`];
  for (const b of bullets) {
    for (const s of splitSentences(clean(b))) out.push(`- ${s}`);
  }
  return out.join("\n");
}

/**
 * Step description: cleaned prose as a list (numbered if the source words a sequence, else bullets).
 * Returns [description, anchor]: anchor is the 1-based line after which the choice box goes.
 */
export function buildDescription(pText, cases, characters, answers = [], tail = "") {
  const clean = (txt) => boldNames(ws(softenCaps(fixTagCase(txt, cases, true))), characters);
  const lines = splitLines(pText);
  if (TEASER_HEADER.test(lines[0])) {
    const desc = teaserDescription(lines, clean);
    return [desc, desc.split("\n").filter((ln) => ln.trim()).length];
  }
  const [proseLines, bullets] = splitBullets(lines);
  const prose = proseLines.join(" ");
  let desc;
  let anchor;
  if (answers.length || tail) {
    const before = splitSentences(clean(prose));
    anchor = before.length;
    const items = [...before, ...answers, ...(tail ? splitSentences(clean(tail)) : [])];
    desc = items.length > 1 ? items.map((s, i) => `${i + 1}. ${s}`).join("\n") : items.join(" ");
  } else {
    // Numbered only when the source words a sequence; otherwise one fact per bullet.
    desc = prose ? listify(clean(prose), SEQ_CUE.test(prose)) : "";
    anchor = desc.split("\n").filter((ln) => ln.trim()).length;
  }
  if (bullets.length) {
    const lst = bullets.map((b) => `- ${clean(b)}`).join("\n");
    desc = desc ? `${desc}\n${lst}` : lst;
  }
  return [desc, anchor];
}

/** Generates a structured guide draft object from a canonical section JSON file. */
export function scaffoldGuide(canonicalPath) {
  const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  if (isReferenceSection(canonical)) return scaffoldReferenceGuide(canonical);

  // Determine type
  let guideType = "walkthrough";
  if (canonical.is_sidequest) guideType = "sidequest";
  else if (canonical.overview?.directions) guideType = "walkthrough_intro";

  // The overview's Save Points are save points, not a route: leave `route` empty.
  const route = [];

  // Objectives: only what the source states. A boss in the data is a stated goal ("Defeat X").
  const objectives = (canonical.bosses ?? []).filter((b) => b.name).map((b) => `Defeat ${b.name}`);

  const itemsSummary = buildItemsSummary(canonical);

  // Align markers with paragraphs
  const markersItems = canonical.markers?.items ?? [];
  const rawText = canonical.text ?? "";
  const markersNotes = buildNotes(canonical.markers?.notes ?? [], splitLines(rawText));
  const noteRanges = markersNotes.map((mn) => [mn.line, mn.end]);

  const boxes = findBoxes(splitLines(rawText));
  let paragraphs = mergeAcrossInfoBoxes(splitTextParagraphs(rawText), boxes);
  let extras;
  [paragraphs, extras] = foldParagraphs(paragraphs, findChoiceBlocks(rawText));
  const boxLines = new Set(boxes.flatMap((b) => Array.from({ length: b.end - b.start + 1 }, (_, k) => b.start + k)));
  const cases = buildNameCases(canonical);
  const characters = partyNames(canonical);
  const paraStep = new Map();
  const stepEnemiesSet = new Map(); // enemies named in each step, keyed by step id

  const steps = [];
  let stepId = 1;
  const assignedItems = new Set();
  const assignedNotes = new Set();

  paragraphs.forEach(([startLine, endLine, pText], pIdx) => {
    // Check for NOTE headers in paragraph
    if (isNoteParagraph(pText) || isHeadingParagraph(pText)) return;
    // Tail of a NOTE box (wrapped lines after the rule line): already captured as a note
    if (noteRanges.some(([a, b]) => a <= startLine && startLine <= b)) return;
    const probe = ws(pText).slice(0, 40);
    if (markersNotes.some((mn) => ws(mn.text ?? "").includes(probe))) return;

    // Find items within start_line - 1 to end_line + 1
    const stepRewards = [];
    markersItems.forEach((mi, idx) => {
      const mLine = mi.line ?? 0;
      if (boxLines.has(mLine)) return; // tag inside a prize table / card: the box carries it
      if (startLine - 1 <= mLine && mLine <= endLine + 1) {
        assignedItems.add(idx);
        const matched = mi.matched_overview_item;
        const rawName = mi.name || "";
        const reward = {
          name: matched || cases.get(normName(rawName)) || rawName,
          category: mi.category || "items",
        };
        if (matched) reward.matched_overview_item = matched;
        stepRewards.push(reward);
      }
    });

    // Find notes within start_line - 1 to end_line + 1.
    // A note belongs to the nearest preceding paragraph and is attached only once.
    const stepNotes = [];
    let reach = endLine + NOTE_GAP;
    markersNotes.forEach((mn, idx) => {
      const nLine = mn.line ?? 0;
      if (!assignedNotes.has(idx) && startLine <= nLine && nLine <= reach) {
        assignedNotes.add(idx);
        reach = Math.max(reach, (mn.end ?? nLine) + NOTE_GAP);
        stepNotes.push(makeNote(mn, cases, characters));
      }
    });

    const extra = extras.get(startLine) ?? {};
    const choices = [];
    const answers = [];
    for (const block of extra.blocks ?? []) {
      choices.push(...choiceEntries(block));
      answers.push(...requiredAnswers(block));
    }

    const pLower = pText.toLowerCase();
    const matchedEnemies = (canonical.enemies ?? []).map((e) => e.name)
      .filter((name) => pLower.includes(String(name ?? "").toLowerCase()));
    const stepType = inferStepType(pText, canonical.bosses ?? [], stepRewards.length > 0, choices.length > 0,
      matchedEnemies.length > 0);

    // Strip [_TAG_] marks, cut long prose into a numbered list, keep source bullets one per line
    const [cleanDesc, choiceAnchor] = buildDescription(pText, cases, characters, answers, extra.tail ?? "");
    if (choices.length && choiceAnchor) {
      for (const c of choices) c.after_item = choiceAnchor;
    }

    const step = { id: stepId, description: cleanDesc, type: stepType };
    if (matchedEnemies.length) stepEnemiesSet.set(stepId, unique(matchedEnemies));
    if (choices.length) step.choices = choices;
    if (stepNotes.length) step.notes = stepNotes;
    step.rewards = stepRewards;

    steps.push(step);
    paraStep.set(pIdx, step);
    stepId++;
  });

  // Notes that precede their paragraph go to the step built from the paragraph that follows them.
  const stepStarts = [...paraStep.keys()].sort((a, b) => a - b).map((pIdx) => [paragraphs[pIdx][0], paraStep.get(pIdx)]);
  markersNotes.forEach((mn, idx) => {
    if (assignedNotes.has(idx) || !steps.length) return;
    const target = (stepStarts.find(([first]) => first > (mn.line ?? 0)) ?? [null, steps[steps.length - 1]])[1];
    if (!target.notes) target.notes = [];
    target.notes.push(makeNote(mn, cases, characters));
  });

  attachBoxes(boxes, paragraphs, paraStep, steps, canonical, cases, characters);

  for (const st of steps) {
    if (st.notes) {
      st.notes.sort((a, b) => (a._line ?? 1e9) - (b._line ?? 1e9));
      for (const n of st.notes) delete n._line;
    }
  }

  // An encounter is only recorded for fight steps.
  const canonBossNames = new Set((canonical.bosses ?? []).map((b) => (b.name ?? "").toLowerCase()));
  for (const st of steps) {
    let names = [...(stepEnemiesSet.get(st.id) ?? [])];
    if (st.type === "battle" || st.type === "boss") {
      if (st.boss) {
        // The card names the fight: a neighbouring boss mentioned in the text is not in it.
        names = (st.boss.enemies ?? []).map((e) => e.name).filter(Boolean);
        if (!names.length && canonBossNames.has((st.boss.name ?? "").toLowerCase())) names = [st.boss.name];
      }
      names = unique(names);
      if (names.length) st.encounter = { enemies: names };
    }
  }

  fillItemLocations(itemsSummary, steps);
  boldNavRefs(steps, canonical.navigation ?? {});

  const source = canonical.source ?? {};
  const guideDict = {
    guide: {
      id: canonical.id,
      code: canonical.code,
      title: canonical.title,
      type: guideType,
      category: canonical.category,
      source: {
        game: source.game ?? PROJECT.game,
        author: source.author ?? PROJECT.sourceDefaults.author,
        version: source.version ?? PROJECT.sourceDefaults.version,
        url: source.source_url ?? "",
        source_file: source.source_file ?? "",
      },
      navigation: canonical.navigation ?? {},
      route,
      ...(objectives.length ? { objectives } : {}),
      items_summary: itemsSummary,
      enemies: canonical.enemies ?? [],
      bosses: canonical.bosses ?? [],
      shops: canonical.shops ?? [],
      steps,
    },
  };

  if (canonical.boss) guideDict.guide.boss = canonical.boss;

  // `have one` is the importer picking up the "! = Can only have one" legend, `|` a table border
  const savePoints = (canonical.overview?.save_points ?? []).map((sp) => sp.trim())
    .filter((sp) => HAS_WORD.test(sp) && sp.toLowerCase() !== "have one");
  if (savePoints.length) guideDict.guide.save_points = savePoints;

  // One home per canonical boss: a boss card attached to its step is not repeated in bosses[].
  const attached = new Set(steps.filter((st) => isDict(st.boss)).map((st) => (st.boss.name ?? "").toLowerCase()));
  const canonNames = new Set((canonical.bosses ?? []).map((b) => (b.name ?? "").toLowerCase()));
  if (canonNames.size && [...canonNames].every((n) => attached.has(n))) {
    guideDict.guide.bosses = [];
    delete guideDict.guide.boss;
  }

  normalizeItemNames(guideDict.guide);
  for (const st of guideDict.guide.steps ?? []) {
    // nested source lists become structured blocks (flat text stays a string)
    st.description = blocksFromMarkdown(st.description ?? "");
  }
  return guideDict;
}
