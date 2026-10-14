// lint_guide.mjs - Presentation lint for structured guide JSON (not a fact check).
//
// Flags text that the Guide Transformer should still have cleaned up:
//   prose            paragraph with 3+ sentences or ~40+ words that is not a bullet/numbered list
//   upper-item       item name left in UPPERCASE (e.g. TALISMANOFMERCY, B.DRAGON HORN)
//   raw-tag          a leftover `[_TAG_]` source marker
//   fragment         a step line that starts lowercase (a wrapped source line split off its sentence)
//   mixed-list       a numbered item after a bullet in one step (a bullet's wrapped text leaked)
//   ascii-border     ASCII-art border/box characters (`____`, `¯¯¯`, `.———`, `|` tables, `$$$$`)
//   narrative-item   (info) reward/tag that is not in items_summary (overview omitted it)
//   step-ref         items_summary location cites "(step N)" that does not exist or does not mention the item
//   empty-location   (info) items_summary.obtainable[] with location "" (hints a stated location, never fills it)
//   mojibake         (info) replacement character from a source encoding defect
//
// Each finding is { id, check, severity, location, text }; severity is "warn" or "info".

import { flattenGuide } from "./richtext.mjs";

const MAX_SENTENCES = 2; // 3+ sentences -> list
const MAX_WORDS = 39; // ~40+ words  -> list

const LIST_LINE = /^\s*(?:[-*]\s+|\d+\.\s+)/;
const SENTENCE_SPLIT = /(?<=[.!?])["')\]]*\s+(?=["'(\[*]*[A-Z0-9])/;
const LIST_MARK = /^\s*(?:[-*]|\d+\.)\s+/;
const RAW_TAG = /\[_[^\]]*_\]/;
const ASCII = /(_{5,}|¯{3,}|—{5,}|-{5,}|={5,}|\$\$\$\$|\.—|—\.|\\\s*\$|^\s*\|.*\|\s*$)/m;
const UPPER_RUN = /\b[A-Z][A-Z.'’]*(?:[ ][A-Z][A-Z.'’]*)*\b/g;
const EMPHASIS_WORDS = new Set(["THE", "YOUR", "YOU", "TO", "IN", "AND", "IS", "ARE", "NOT", "BEFORE", "AFTER", "MAKE", "SURE"]);
const ACRONYMS = new Set(["EXP", "HP", "MP", "SP", "NOTE", "BOSS", "SUB-BOSS", "ATK", "DEF", "OK", "TV", "NPC", "VS"]);

const norm = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const plain = (text) => text.replace(/\*\*|__|`/g, "");
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;
const squash = (text) => text.split(/\s+/).filter(Boolean).join(" ");

/** Yields [location, text] for every prose field in the guide. */
function* texts(guide) {
  for (const step of guide.steps ?? []) {
    const sid = step.id;
    yield [`step ${sid}`, step.description ?? ""];
    for (const [i, note] of (step.notes ?? []).entries()) {
      yield [`step ${sid} note ${i + 1}`, note.text ?? ""];
    }
    const boss = step.boss;
    if (boss && typeof boss === "object") {
      yield [`step ${sid} boss ${boss.name ?? ""}`, boss.strategy ?? ""];
    }
  }
  for (const b of guide.bosses ?? []) yield [`boss ${b.name ?? ""}`, b.strategy ?? ""];
  for (const [i, call] of (guide.callouts ?? []).entries()) yield [`callout ${i + 1}`, call.text ?? ""];
  for (const [i, item] of (guide.items_summary?.obtainable ?? []).entries()) {
    yield [`items_summary ${item.name ?? i + 1}`, item.location ?? ""];
  }
}

function knownNames(guide) {
  const names = new Set();
  const summary = guide.items_summary ?? {};
  for (const key of ["obtainable", "initial"]) {
    for (const i of summary[key] ?? []) names.add(norm(i.name));
  }
  for (const shop of guide.shops ?? []) {
    for (const i of shop.inventory ?? []) names.add(norm(i.name));
  }
  for (const step of guide.steps ?? []) {
    for (const r of step.rewards ?? []) names.add(norm(r.name));
  }
  names.delete("");
  return names;
}

/** First source sentence (enemy notes, step text, notes) that mentions `name`, with where it was found. */
function locationHint(guide, name) {
  const needle = String(name ?? "").trim().toLowerCase();
  if (!needle) return "";
  for (const e of guide.enemies ?? []) {
    // an enemy that shares the item's name (e.g. a soul dropped by it): its notes state the location
    if (norm(e.name) === norm(name) && (e.notes ?? "").trim()) {
      return `enemy ${e.name} notes: ${squash(e.notes).slice(0, 100)}`;
    }
  }
  const pools = (guide.enemies ?? []).map((e) => [`enemy ${e.name ?? ""} notes`, e.notes ?? ""]);
  pools.push(...texts(guide));
  for (const [where, text] of pools) {
    if (where.startsWith("items_summary")) continue;
    for (const sent of plain(text || "").split(/(?<=[.!?])\s+|\n+/)) {
      if (sent.toLowerCase().includes(needle)) return `${where}: ${squash(sent).slice(0, 100)}`;
    }
  }
  return "";
}

const isLower = (c) => c !== "" && c === c.toLowerCase() && c !== c.toUpperCase();

export function lintGuide(rawGuide) {
  const guide = flattenGuide(rawGuide); // block-array rich text -> markdown-lite lines
  const findings = [];

  const add = (check, severity, loc, text) => {
    findings.push({
      id: `L${String(findings.length + 1).padStart(3, "0")}`,
      check,
      severity,
      location: loc,
      text: squash(text).slice(0, 140),
    });
  };

  const known = knownNames(guide);
  for (const [loc, raw] of texts(guide)) {
    if (!raw) continue;
    const tag = RAW_TAG.exec(raw);
    if (tag) add("raw-tag", "warn", loc, tag[0]);
    const border = ASCII.exec(raw);
    if (border) add("ascii-border", "warn", loc, border[0]);
    if (raw.includes("�")) {
      // Source encoding defect (e.g. "voil�"): the original character is unrecoverable.
      // Keep the source text, or repair by judgement and record it; never guess silently.
      const i = raw.indexOf("�");
      add("mojibake", "info", loc, raw.slice(Math.max(0, i - 20), i + 20));
    }
    if (loc.startsWith("items_summary")) continue; // a `location` is one verbatim sentence; list/upper checks are for prose

    // Prose blocks: separated by blank lines, skipping list items
    for (const block of raw.split(/\n\s*\n/)) {
      const lines = block.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length || lines.some((l) => LIST_LINE.test(l))) continue;
      const text = plain(lines.map((l) => l.trim()).join(" "));
      const sentences = text.split(SENTENCE_SPLIT).filter((s) => s.trim());
      const words = wordCount(text);
      // a single sentence cannot be split into one-fact items without rewording it
      if (sentences.length > MAX_SENTENCES || (words > MAX_WORDS && sentences.length > 1)) {
        add("prose", "warn", loc, `${sentences.length} sentences / ${words} words: ${text}`);
      }
    }

    if (loc.split(" ").length - 1 === 1) { // step description only (not notes / boss strategy)
      const bulletAt = new Map(); // indent -> a bullet was seen at that nesting level
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const indent = line.length - line.trimStart().length;
        for (const k of [...bulletAt.keys()]) {
          if (k > indent) bulletAt.delete(k); // leaving a nested list: its siblings start fresh
        }
        const body = plain(line.replace(LIST_MARK, "")).replace(/^["'([ ]+/, "");
        if (isLower(body.charAt(0))) add("fragment", "warn", loc, line.trim());
        if (/^\s*\d+\.\s/.test(line) && bulletAt.get(indent)) add("mixed-list", "warn", loc, line.trim());
        if (/^\s*[-*]\s/.test(line)) bulletAt.set(indent, true);
      }
    }

    const flat = plain(raw);
    for (const m of flat.matchAll(UPPER_RUN)) {
      const run = m[0];
      const letters = run.replace(/[^A-Za-z]/g, "");
      if (letters.length < 5 || ACRONYMS.has(run) || run.startsWith("I ") || run.startsWith("A ")) {
        continue; // "I STRONGLY recommend" is emphasis, not a tag
      }
      // a known item name, or a dotted/multi-word run, is an item tag left in caps
      const emphasis = run.split(/\s+/).some((w) => EMPHASIS_WORDS.has(w)); // "SAVE YOUR GAME" is a shout, not a tag
      if (known.has(norm(run)) || run.replace(/^\.+|\.+$/g, "").includes(".") ||
          (run.includes(" ") && letters.length >= 8 && !emphasis)) {
        add("upper-item", "warn", loc, run);
      }
    }
  }

  // items tagged in the text but missing from the overview-derived items_summary
  const summary = guide.items_summary ?? {};
  const listed = new Set();
  for (const key of ["obtainable", "initial"]) {
    for (const i of summary[key] ?? []) listed.add(norm(i.name));
  }
  const seen = new Set();
  for (const step of guide.steps ?? []) {
    for (const r of step.rewards ?? []) {
      const key = norm(r.name);
      if (key && !listed.has(key) && !seen.has(key)) {
        seen.add(key);
        add("narrative-item", "info", `step ${step.id}`,
          `${r.name} is a reward here but is not in items_summary (overview omits it)`);
      }
    }
  }

  // "(step N)" cites in a location must point at a step that actually mentions the item
  const byId = new Map((guide.steps ?? []).map((st) => [String(st.id), st]));
  for (const key of ["obtainable", "initial"]) {
    for (const item of summary[key] ?? []) {
      for (const m of (item.location ?? "").matchAll(/\bsteps?\s+(\d+)/gi)) {
        const n = m[1];
        const st = byId.get(n);
        const where = `items_summary ${item.name ?? ""}`;
        if (!st) {
          add("step-ref", "warn", where, `cites step ${n}, which does not exist`);
          continue;
        }
        const blob = [st.description ?? "", ...(st.rewards ?? []).map((r) => r.name ?? ""),
          ...(st.notes ?? []).map((x) => x.text ?? "")].join(" ");
        if (!norm(blob).includes(norm(item.name))) {
          add("step-ref", "warn", where, `cites step ${n}, which does not mention ${item.name}`);
        }
      }
    }
  }

  // obtainable items with no stated location: hint where the source mentions them (a human confirms)
  for (const item of summary.obtainable ?? []) {
    if (!(item.location ?? "").trim()) {
      const hint = locationHint(guide, item.name ?? "");
      add("empty-location", "info", `items_summary ${item.name ?? ""}`,
        hint ? `location is empty; source mentions it at ${hint}` : "location is empty; no mention in text/notes");
    }
  }
  return findings;
}
