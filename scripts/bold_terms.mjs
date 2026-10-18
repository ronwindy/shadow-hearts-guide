// bold_terms.mjs - Bold important game terms (**term**) in the prose of structured sections.
//
// Dictionary = names mined from the canonical appendices + scripts/term_extras.json
// (manual statuses/locations/characters and a deny list). Only prose fields are touched
// (step description, notes text, boss strategy, hub text); data fields keep exact names.

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT_DIR } from "./status.mjs";
import { PROJECT } from "./project_config.mjs";
import { pyJson } from "./status.mjs";

const CANON = join(ROOT_DIR, "canonical-sources", "sections");
const STRUCT = join(ROOT_DIR, "structured-content", "sections");
const EXTRAS = join(ROOT_DIR, PROJECT.termExtrasFile);

const NAME = "[A-Z][\\w'’ .&-]*?";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const allMatches = (text, re) => [...text.matchAll(re)];

function jsonFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
}

function canonText(fileId) {
  const name = jsonFiles(CANON).find((f) => f.startsWith(`${fileId}-`));
  if (!name) throw new Error(`No canonical file for ${fileId}`);
  return JSON.parse(readFileSync(join(CANON, name), "utf8")).text;
}

/** 'TalismanOfLuck' -> 'Talisman of Luck' (same display rule as the scaffold). */
export function camel(name) {
  name = name.replace(/(?<=\w's)(?=[A-Z])/g, " "); // "Alchemist'sWater"
  if (!/^[A-Z][a-z']+(?:[A-Z][a-z]+)+$/.test(name)) return name;
  const words = allMatches(name, /[A-Z][a-z']*/g).map((m) => m[0]);
  return words.map((w) => (w === "Of" || w === "The" ? w.toLowerCase() : w)).join(" ");
}

export function mineTerms() {
  const cats = new Map();

  const add = (cat, names) => {
    for (let n of names) {
      n = camel(n.trim());
      if (n.length >= 3 && /[A-Za-z]/.test(n)) {
        if (!cats.has(cat)) cats.set(cat, new Set());
        cats.get(cat).add(n);
      }
    }
  };
  const grab = (text, re) => allMatches(text, re).map((m) => m[1]);

  // skills/souls: "| 18 | Moon Howl | Earth |" rows and fusion headers "Raging Tiger (Earth, Level 1)"
  const t = canonText("a-1-01");
  add("skills", grab(t, new RegExp(`^\\|\\s+(?:\\d+|)\\s*\\|\\s+(${NAME})\\s+\\|`, "gm")));
  add("fusions", grab(t, /^\|\s{2,3}(\S[^|]*?)\s+\(\w+, Level \d\)/gm));
  // equipment tables: "|  Leather Gloves     |    0 /   0  |"
  for (const [fid, cat] of [["a-1-02", "weapons"], ["a-1-03", "armor"], ["a-1-04", "accessories"]]) {
    add(cat, grab(canonText(fid), new RegExp(`^\\|\\s{2}(${NAME})\\s+\\|\\s+[-\\d]+ /`, "gm")));
  }
  // items / valuables: "|  Thera Leaf         |  Restores ..."
  for (const [fid, cat] of [["a-1-05", "items"], ["a-1-06", "valuables"]]) {
    add(cat, grab(canonText(fid), new RegExp(`^\\|\\s{2}(${NAME})\\s+\\|\\s{2}\\S`, "gm")));
  }
  // bestiary / bosses / NPCs
  add("enemies", grab(canonText("a-1-13"), new RegExp(`\\|\\s+No\\.\\s+\\d+\\s+\\|\\s+(${NAME})\\s+\\|`, "g")));
  add("bosses", grab(canonText("a-1-14"), new RegExp(`^\\|\\s(${NAME})\\s+\\|\\s+[\\d,]+ HP\\s+\\|`, "gm")));
  add("npcs", grab(canonText("a-1-12"), new RegExp(`^\\|\\s+[\\dA-Z-]+\\s+\\|\\s+(${NAME})\\s+\\|\\s+\\w+\\s+\\|`, "gm")));
  // status abnormalities from the in-game help
  add("statuses", grab(canonText("a-1-15"), /Status Abnormality \/ ([A-Z][\w ]+?)\s*$/gm));
  // locations from walkthrough titles: "Shanghai, Huayuan (1)" -> Shanghai, Huayuan
  const locs = new Set();
  for (const name of jsonFiles(STRUCT).filter((f) => /^w-[12]-/.test(f))) {
    const title = JSON.parse(readFileSync(join(STRUCT, name), "utf8")).guide.title;
    for (const p of title.split(",")) locs.add(p.replace(/\s*\(\d+\)$/, "").trim());
  }
  add("locations", [...locs].filter((l) => l !== "Asia Side Quests"));
  return cats;
}

export function loadExtras() {
  return existsSync(EXTRAS) ? JSON.parse(readFileSync(EXTRAS, "utf8")) : {};
}

export function buildDictionary() {
  const cats = mineTerms();
  const extras = loadExtras();
  const terms = new Set();
  for (const names of cats.values()) for (const n of names) terms.add(n);
  for (const [key, names] of Object.entries(extras)) {
    if (!["deny", "_doc", "numbered"].includes(key)) for (const n of names) terms.add(n);
  }
  for (const n of extras.deny ?? []) terms.delete(n);
  return [...terms].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
}

export function ambiguousTerms() {
  return new Set(loadExtras().ambiguous ?? []);
}

// --- applying -------------------------------------------------------------------------

function atSentenceStart(before) {
  const tail = before.replace(/ +$/, "");
  return tail === "" ||
    ["\n", ".", "!", "?", ":", '"', "•"].some((c) => tail.endsWith(c)) ||
    /(?:^|\n)\s*-$/.test(tail);
}

export function compilePattern(terms) {
  const numbered = new Set(loadExtras().numbered ?? []);
  const alts = terms.map((t) => escapeRe(t) + (numbered.has(t) ? "(?: No\\. \\d+)?" : "")).join("|");
  // case-sensitive; optional plural; not inside a word
  return new RegExp(`(?<![\\w*])(${alts})(es|s)?(?![\\w*])`, "g");
}

/** Python's pattern.fullmatch(): the whole string must match. */
function fullmatch(pat, s) {
  const m = new RegExp(`^(?:${pat.source})$`, pat.flags.replace("g", "")).exec(s);
  return m !== null;
}

/** '**London** Rats' -> '**London Rats**' when the joined words are one known term. */
function mergeSpans(text, pat) {
  return text.replace(/\*\*([^*]+)\*\*((?: [\w-]+){1,3})/g, (whole, g1, g2) => {
    const words = /^((?: [\w-]+){1,3})/.exec(g2);
    if (words) {
      const parts = words[1].split(" ");
      for (let n = parts.length - 1; n > 0; n--) {
        const tail = parts.slice(0, n + 1).join(" ");
        // keep the words after the term: the Python original dropped them ("**London** Rats are" -> "**London Rats**")
        if (fullmatch(pat, g1 + tail)) return `**${g1}${tail}**${g2.slice(tail.length)}`;
      }
    }
    return whole;
  });
}

/** Bold unmarked occurrences; leave existing **...** spans and `code` spans alone. */
export function boldText(text, pat, ambiguous = ambiguousTerms()) {
  text = mergeSpans(text, pat);
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]*`)/); // capture group: odd indices are protected spans
  let done = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const part = parts[i];
      const prefix = done;
      parts[i] = part.replace(pat, (match, term, suffix, offset) => {
        if (ambiguous.has(term) && atSentenceStart(prefix + part.slice(0, offset))) return match;
        return `**${term}${suffix ?? ""}**`;
      });
    }
    done += parts[i];
  }
  return parts.join("");
}

function walkRich(node, pat) {
  if (typeof node === "string") return boldText(node, pat);
  if (Array.isArray(node)) return node.map((n) => walkRich(n, pat));
  if (node && typeof node === "object") {
    const out = { ...node };
    if ("text" in out) out.text = walkRich(out.text, pat);
    if ("items" in out) out.items = walkRich(out.items, pat);
    if ("children" in out) out.children = walkRich(out.children, pat);
    return out;
  }
  return node;
}

function boldSection(guide, pat) {
  const g = structuredClone(guide);
  if (Array.isArray(g.objectives)) g.objectives = g.objectives.map((o) => boldText(o, pat));
  if (typeof g.initial_setup?.note === "string") g.initial_setup.note = boldText(g.initial_setup.note, pat);
  for (const step of g.steps ?? []) {
    if (typeof step.description === "string") step.description = boldText(step.description, pat);
    for (const note of step.notes ?? []) note.text = walkRich(note.text, pat);
    const boss = step.boss;
    if (boss && boss.strategy) boss.strategy = walkRich(boss.strategy, pat);
  }
  for (const boss of g.bosses ?? []) {
    if (boss.strategy) boss.strategy = walkRich(boss.strategy, pat);
  }
  for (const callout of g.callouts ?? []) {
    if (typeof callout.text === "string") callout.text = boldText(callout.text, pat);
  }
  return g;
}

function diffTerms(oldVal, newVal, found) {
  if (typeof oldVal === "string" && typeof newVal === "string") {
    const before = new Set([...oldVal.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]));
    for (const m of newVal.matchAll(/\*\*([^*]+)\*\*/g)) {
      if (!before.has(m[1])) found.push(m[1]);
    }
  } else if (oldVal && typeof oldVal === "object" && newVal && typeof newVal === "object"
             && !Array.isArray(oldVal) && !Array.isArray(newVal)) {
    for (const k of Object.keys(oldVal)) diffTerms(oldVal[k], newVal[k], found);
  } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    oldVal.forEach((o, i) => { if (i < newVal.length) diffTerms(o, newVal[i], found); });
  }
}

/** Bolds terms in one structured file; returns the newly bolded terms (writes only when found). */
export function boldFile(path, pat = compilePattern(buildDictionary()), write = true) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  const newGuide = boldSection(data.guide, pat);
  const found = [];
  diffTerms(data.guide, newGuide, found);
  if (write && found.length) {
    data.guide = newGuide;
    writeFileSync(path, pyJson(data) + "\n", "utf8");
  }
  return found;
}
