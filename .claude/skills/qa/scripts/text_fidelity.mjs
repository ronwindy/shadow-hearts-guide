// text_fidelity.mjs - Ordered word diff between canonical prose and structured step text.
//
// The field checks in verify_guide.mjs compare numbers stored in structured fields (HP, prices).
// This module covers the prose: each step line and note is aligned against the canonical
// walkthrough prose (box/table/border lines removed) and reports
//   altered:     a replaced or added word that is a number, a polarity word or a bolded term
//                (altered-high when a number/polarity word is swapped for another: nine -> seven)
//   order:       consecutive step lines whose canonical positions go backwards
//   omitted:     canonical prose sentences inside the walkthrough span that no line covers
//   unsupported: a step line or note with no matching canonical prose
// Rewording that only drops or swaps filler words is tolerated.

const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "twenty", "thirty", "fifty",
  "hundred", "thousand", "first", "second", "third", "fourth", "fifth", "once", "twice",
  "double", "doubles", "triple", "triples", "half", "all", "both", "every", "each",
]);
const POLARITY_WORDS = new Set([
  "not", "no", "never", "won't", "can't", "cannot", "don't", "doesn't", "isn't", "aren't",
  "didn't", "wouldn't", "shouldn't", "couldn't", "without", "also", "always", "only",
  "must", "before", "after", "until", "unless", "left", "right", "up", "down", "north",
  "south", "east", "west", "upper", "lower", "top", "bottom",
]);
const SIGNIFICANT = new Set([...NUMBER_WORDS, ...POLARITY_WORDS]);

const BORDER = /[=_\-~*#.'\\/]{4,}|[^\x00-\x7F]{3,}/g;
const XREF = /\*\*\[[A-Z](?:-[0-9A-Z]+)+\][^*]*\*\*|\[[A-Z](?:-[0-9A-Z]+)+\]/g;
const WORD = /[a-z0-9]+(?:'[a-z]+)?/g;
const isDigits = (t) => /^[0-9]+$/.test(t);
const isSignificant = (t) => SIGNIFICANT.has(t) || isDigits(t);

/** Port of difflib.SequenceMatcher(None, a, b, autojunk=False) without junk heuristics. */
class SequenceMatcher {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.b2j = new Map();
    b.forEach((x, j) => {
      if (!this.b2j.has(x)) this.b2j.set(x, []);
      this.b2j.get(x).push(j);
    });
  }

  findLongestMatch(alo, ahi, blo, bhi) {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map();
      for (const j of this.b2j.get(this.a[i]) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = newj2len;
    }
    while (besti > alo && bestj > blo && this.a[besti - 1] === this.b[bestj - 1]) {
      besti--; bestj--; bestsize++;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi &&
           this.a[besti + bestsize] === this.b[bestj + bestsize]) {
      bestsize++;
    }
    return [besti, bestj, bestsize];
  }

  /** Non-empty matching blocks as [i, j, size], followed by the sentinel [la, lb, 0] like difflib. */
  matchingBlocks() {
    const queue = [[0, this.a.length, 0, this.b.length]];
    const matching = [];
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop();
      const [i, j, k] = this.findLongestMatch(alo, ahi, blo, bhi);
      if (k) {
        matching.push([i, j, k]);
        if (alo < i && blo < j) queue.push([alo, i, blo, j]);
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
      }
    }
    matching.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const merged = [];
    let [i1, j1, k1] = [0, 0, 0];
    for (const [i2, j2, k2] of matching) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2;
      } else {
        if (k1) merged.push([i1, j1, k1]);
        [i1, j1, k1] = [i2, j2, k2];
      }
    }
    if (k1) merged.push([i1, j1, k1]);
    merged.push([this.a.length, this.b.length, 0]);
    return merged;
  }

  /** [tag, i1, i2, j1, j2] opcodes like difflib.get_opcodes(). */
  opcodes() {
    const out = [];
    let i = 0, j = 0;
    for (const [ai, bj, size] of this.matchingBlocks()) {
      let tag = "";
      if (i < ai && j < bj) tag = "replace";
      else if (i < ai) tag = "delete";
      else if (j < bj) tag = "insert";
      if (tag) out.push([tag, i, ai, j, bj]);
      i = ai + size;
      j = bj + size;
      if (size) out.push(["equal", ai, i, bj, j]);
    }
    return out;
  }
}

function tokens(text) {
  let t = String(text ?? "").replace(/\*\*|`/g, "");
  t = t.replace(/\[_|_\]/g, " ");
  t = t.replace(/(?<=[a-z])(?=[A-Z])/g, " "); // TeaOfTheHolyOne -> Tea Of The Holy One
  t = t.replace(/_/g, " ").replace(/[’‘]/g, "'");
  return (t.toLowerCase().match(WORD) ?? []).map((w) => (w.endsWith("'s") ? w.slice(0, -2) : w));
}

const stripListMarker = (line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "");

/** Canonical prose as one word list plus [start, end) word ranges of its sentences. */
function canonicalProse(text) {
  const lines = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.replace(BORDER, " ").trim(); // NOTE underlines share a line with text
    if (!line || line.includes("|")) continue;
    lines.push(line.replace(/^NOTE\s+/, "").replace(XREF, ""));
  }
  const prose = lines.join(" ");
  const words = [];
  const sentences = [];
  for (const sent of prose.split(/(?<!Mr\.)(?<!Dr\.)(?<!Mrs\.)(?<=[.!?])\s+/)) {
    const toks = tokens(sent);
    if (toks.length) {
      sentences.push([words.length, words.length + toks.length]);
      words.push(...toks);
    }
  }
  return [words, sentences];
}

/** Step description lines (ordered) and note lines (order-free) with their bolded terms. */
function units(guide) {
  const out = [];
  for (const step of guide.steps ?? []) {
    const sid = step.id;
    (step.description || "").split(/\r?\n/).forEach((line, idx) => {
      if (line.trim()) out.push({ loc: `steps[${sid}].description line ${idx + 1}`, text: line, ordered: true });
    });
    (step.notes ?? []).forEach((note, n) => {
      if (note.table || note.preformatted) return; // caption of a copied table/art block
      (note.text || "").split(/\r?\n/).forEach((line, idx) => {
        if (line.trim()) out.push({ loc: `steps[${sid}].notes[${n}] line ${idx + 1}`, text: line, ordered: false });
      });
    });
    (step.choices ?? []).forEach((ch, n) => {
      out.push({ loc: `steps[${sid}].choices[${n}]`, text: ch.option ?? "", ordered: false });
    });
  }
  for (const u of out) {
    u.text = u.text.replace(XREF, ""); // scaffold-added **[W-2-07] Title** cross-refs
    u.words = tokens(stripListMarker(u.text));
    u.bold = new Set([...u.text.matchAll(/\*\*(.+?)\*\*/g)].flatMap((m) => tokens(m[1])));
  }
  return out.filter((u) => u.words.length >= 3);
}

/** Joins runs that spell one source token (Tea of the Holy One -> teaoftheholyone). */
function squash(words, vocab) {
  const out = [];
  let i = 0;
  while (i < words.length) {
    let hit = false;
    for (let j = Math.min(words.length, i + 6); j >= i + 2; j--) {
      const joined = words.slice(i, j).join("");
      if (vocab.has(joined)) {
        out.push(joined);
        i = j;
        hit = true;
        break;
      }
    }
    if (!hit) {
      out.push(words[i]);
      i++;
    }
  }
  return out;
}

/** Drops gen runs that spell a squashed source tag (TEAOFTHEHOLYONE vs Tea of the Holy One). */
function unsquash(gen0, src0) {
  const gen = [...gen0];
  const src = [...src0];
  for (const t of [...src]) {
    let found = false;
    for (let i = 0; i < gen.length && !found; i++) {
      for (let j = i + 2; j <= gen.length; j++) {
        if (gen.slice(i, j).join("") === t) {
          gen.splice(i, j - i);
          src.splice(src.indexOf(t), 1);
          found = true;
          break;
        }
      }
    }
  }
  return [gen, src];
}

const triKey = (words) => words.join("\u0001");

/** Best canonical start offset by trigram voting; -1 when nothing matches.
 *  Among near-equal candidates (repeated source phrases) the first one at or after `cursor` wins. */
function locate(words, index, cursor = 0) {
  const votes = new Map();
  for (let i = 0; i < words.length - 2; i++) {
    for (const pos of index.get(triKey(words.slice(i, i + 3))) ?? []) {
      const off = pos - i;
      votes.set(off, (votes.get(off) ?? 0) + 1);
    }
  }
  if (!votes.size) return -1;
  const top = Math.max(...votes.values());
  const good = [...votes].filter(([, v]) => v >= 0.8 * top).map(([o]) => o).sort((a, b) => a - b);
  return good.find((o) => o >= cursor) ?? good[0];
}

const pyList = (items) => `[${items.map((x) => `'${x}'`).join(", ")}]`;

/**
 * Findings with `kind` altered-high (a number/polarity word swapped), altered, order, omitted, unsupported.
 * `mergedTexts`: canonical text of sections merged into this one (qa-status MERGED), placed before it.
 */
export function checkTextFidelity(canonical, guide, mergedTexts = []) {
  const fullText = [...mergedTexts, canonical.text ?? ""].join("\n");
  const [canon, sentences] = canonicalProse(fullText);
  if (!canon.length) return [];
  const index = new Map();
  for (let i = 0; i < canon.length - 2; i++) {
    const key = triKey(canon.slice(i, i + 3));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(i);
  }

  const findings = [];
  const covered = new Array(canon.length).fill(false);
  const orderedHits = [];
  let cursor = 0;

  const add = (kind, loc, src, gen, desc) => {
    findings.push({ kind, location: loc, source: src, generated: gen, description: desc });
  };

  const vocab = new Set(canon);
  const allWords = new Set(tokens(fullText)); // includes box/table lines

  for (const u of units(guide)) {
    const w = squash(u.words, vocab);
    u.words = w;
    u.bold = new Set([...squash([...u.bold].sort(), vocab), ...u.bold]);
    const fromTable = w.some(isDigits) && w.filter((t) => allWords.has(t)).length / w.length >= 0.8;
    const off = locate(w, index, cursor);
    if (off < 0 && fromTable) continue; // row built from a source table/box
    if (off < 0) {
      if (w.length >= 6) {
        add("unsupported", u.loc, "(no matching source prose)", u.text.slice(0, 160),
          "Line has no matching canonical prose (invented or heavily reworded?)");
      }
      continue;
    }
    let lo = Math.max(0, off - 8);
    let hi = Math.min(canon.length, off + 2 * w.length + 12);
    let sm = new SequenceMatcher(w, canon.slice(lo, hi));
    let blocks = sm.matchingBlocks().filter(([, , size]) => size);
    if (blocks.length) { // trim the window to the aligned span
      const [fa, fb] = blocks[0];
      const [la, lb, lsize] = blocks[blocks.length - 1];
      const newLo = lo + Math.max(0, fb - fa - 1);
      const newHi = lo + lb + lsize + (w.length - la - lsize) + 1;
      lo = newLo;
      hi = newHi;
      sm = new SequenceMatcher(w, canon.slice(lo, hi));
    }
    const window = canon.slice(lo, hi);
    const matchingBlocks = sm.matchingBlocks();
    const matched = matchingBlocks.reduce((s, [, , size]) => s + size, 0);
    if (matched / w.length < 0.5) {
      if (w.length >= 6 && !fromTable) {
        add("unsupported", u.loc, window.slice(0, 30).join(" "), u.text.slice(0, 160),
          `Only ${matched}/${w.length} words match the closest canonical prose`);
      }
      continue;
    }
    for (const [, bj, size] of matchingBlocks) {
      for (let j = bj; j < bj + size; j++) covered[lo + j] = true;
    }
    for (const [tag, i1, i2, j1, j2] of sm.opcodes()) {
      if (tag !== "replace" && tag !== "delete") continue; // dropped canonical words are allowed tightening
      const [gen, src] = unsquash(w.slice(i1, i2), window.slice(j1, j2));
      const atEdge = (i2 === w.length && j2 === window.length) || (i1 === 0 && j1 === 0);
      // a word moved within the line ("also you should" -> "you should also") is not a change
      const flagged = new Set(gen.filter((t) => SIGNIFICANT.has(t) || isDigits(t) || u.bold.has(t))
        .filter((t) => !window.includes(t)));
      if (!atEdge) { // at an edge, src is just neighbouring prose
        for (const t of src) {
          if (isSignificant(t) && !w.includes(t)) flagged.add(t);
        }
      }
      if (flagged.size) {
        const genSet = new Set(gen.filter((t) => !window.includes(t)));
        const srcSet = new Set(src.filter((t) => !w.includes(t)));
        const swapped = tag === "replace" && !atEdge &&
          [...genSet].some(isSignificant) && [...srcSet].some(isSignificant);
        add(swapped ? "altered-high" : "altered", u.loc,
          window.slice(Math.max(0, j1 - 4), j2 + 4).join(" "),
          w.slice(Math.max(0, i1 - 4), i2 + 4).join(" "),
          `Changed/added words vs. canonical: ${pyList([...flagged].sort())}`);
      }
    }
    if (u.ordered) {
      orderedHits.push([lo + matchingBlocks[0][1], u]);
      cursor = orderedHits[orderedHits.length - 1][0];
    }
  }

  for (let k = 1; k < orderedHits.length; k++) {
    const [prevPos, prev] = orderedHits[k - 1];
    const [pos, cur] = orderedHits[k];
    if (pos < prevPos) {
      add("order", cur.loc, `canonical word ${pos} comes before word ${prevPos} (${prev.loc})`,
        cur.text.slice(0, 160), "Step line appears in a different order than in the canonical prose");
    }
  }

  if (orderedHits.length) {
    const start = Math.min(...orderedHits.map(([p]) => p));
    const end = Math.max(...orderedHits.map(([p, u]) => p + u.words.length));
    for (const [s, e] of sentences) {
      if (e - s < 4 || s < start || e > end) continue;
      let c = 0;
      for (let k = s; k < e; k++) if (covered[k]) c++;
      if (c / (e - s) < 0.34) {
        add("omitted", "steps", canon.slice(s, e).join(" ").slice(0, 160), "(not found in step text or notes)",
          "Canonical prose sentence inside the walkthrough is not covered by any step line");
      }
    }
  }
  return findings;
}
