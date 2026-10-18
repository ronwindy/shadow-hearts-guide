// Deterministic parser for a-1-01 Special Skills / Souls.
// Shared by the scaffold (builds reference_groups) and QA (rebuilds from the canonical and compares).
//
// Source layout:
//   intro lines
//   .---.  |  Yuri  |   then a legend box, then one box per fusion:
//     |   Name (Element, Level n)          SP Needed: 16 |
//     |   summary line                                   |
//     |   Spaced Name                                    |   <- description title + wrapped lines
//     |   description ...                                |
//     |-----.------.-----.------|
//     |  MP | Special Skill | Class | Description        |  (rows may wrap; wrapped rows have blank MP/skill)
//   .---.  |  Alice  |   then one flat table (MP | <list name> | LV | Class | Description) ending in a ' border.

const ws = (s) => s.replace(/\s+/g, " ").trim();

function rowCells(line, n) {
  const p = line.split("|");
  return p.length === n + 2 && p[0] === "" && p[n + 1] === "" ? p.slice(1, n + 1) : null;
}

/** Fold wrapped rows (blank key cells) into the previous row. */
function pushRow(rows, cells, keyCols) {
  const c = cells.map(ws);
  if (rows.length && keyCols.every((i) => !c[i])) {
    const prev = rows[rows.length - 1];
    c.forEach((v, i) => { if (v) prev.cells[i] = ws(`${prev.cells[i]} ${v}`); });
  } else rows.push({ cells: c });
}

const RE_NAME = /^\|   (\S.*?)   \|$/;
const RE_TOP = /^\.—+\.$/;
const RE_SPLIT_LEGEND = /^\|——/;
const RE_SPLIT_TABLE = /^\|—————\./;
const RE_CLOSE = /^'—/;
const RE_EQ = /^\|=+/;
const RE_FUSION_END = /^\|_{3,}/;
const RE_FUSION_HEAD = /^\|   (.+?)\s{2,}SP Needed: (\S+)\s*\|$/;
const RE_BOX_LINE = /^\|(.*)\|$/;

/** @returns {{title: string, intro?: string, cards?: object[], columns?: string[], rows?: object[]}[] | null} */
export function parseSkillGroups(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const groups = [];
  const intro = [];
  let g = null;
  let mode = "pre"; // pre | afterName | legend | idle | fusionHead | fusionDesc | fusionRows | tableHead | tableRows
  let card = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameM = RE_NAME.exec(line);
    if (nameM && !/SP Needed/.test(line) && RE_TOP.test(lines[i - 1] ?? "") && (mode === "pre" || mode === "idle")) {
      g = { title: ws(nameM[1]) };
      if (intro.length) { g.intro = intro.join(" "); intro.length = 0; }
      groups.push(g);
      mode = "afterName";
      continue;
    }
    if (mode === "pre") {
      if (line.trim() && !/[«»\\]|^\s*_+\s*$|^\s*¯+\s*$/.test(line) && !/^\.—/.test(line)) intro.push(ws(line));
      continue;
    }
    if (mode === "afterName") {
      if (RE_SPLIT_TABLE.test(line)) { mode = "tableHead"; g.rows = []; continue; }
      if (RE_SPLIT_LEGEND.test(line)) { mode = "legend"; continue; } // Yuri legend box
      throw new Error(`unexpected line after group name ${g.title}: ${line}`);
    }
    if (mode === "legend") {
      if (RE_CLOSE.test(line)) { mode = "idle"; g.cards = []; }
      continue;
    }
    if (mode === "tableHead") {
      if (!g.columns) {
        const c = rowCells(line, 5);
        if (!c) throw new Error(`bad table header in ${g.title}: ${line}`);
        g.columns = c.map(ws);
        continue;
      }
      if (RE_EQ.test(line)) { mode = "tableRows"; continue; }
      throw new Error(`unexpected line in table head: ${line}`);
    }
    if (mode === "tableRows") {
      if (RE_CLOSE.test(line)) { mode = "idle"; continue; }
      const c = rowCells(line, 5);
      if (!c) throw new Error(`bad skill row in ${g.title}: ${line}`);
      pushRow(g.rows, c, [0, 1]);
      continue;
    }
    if (mode === "idle") {
      const h = RE_FUSION_HEAD.exec(line);
      if (h && g.cards) {
        const nm = /^(.*?)\s*\((.*)\)$/.exec(ws(h[1]));
        card = { name: nm ? ws(nm[1]) : ws(h[1]), ...(nm ? { class: ws(nm[2]) } : {}), sp: ws(h[2]), summary: "", description: [], rows: [] };
        g.cards.push(card);
        mode = "fusionHead";
      }
      continue;
    }
    if (mode === "fusionHead") {
      const m = RE_BOX_LINE.exec(line);
      if (m && ws(m[1])) { card.summary = ws(m[1]); mode = "fusionDesc"; continue; }
      if (m) continue;
      throw new Error(`unexpected line in fusion head (${card.name}): ${line}`);
    }
    if (mode === "fusionDesc") {
      if (RE_SPLIT_TABLE.test(line)) { mode = "fusionRows"; continue; }
      const m = RE_BOX_LINE.exec(line);
      if (!m) throw new Error(`unexpected line in fusion description (${card.name}): ${line}`);
      if (ws(m[1])) card.description.push(ws(m[1]));
      continue;
    }
    if (mode === "fusionRows") {
      if (RE_FUSION_END.test(line) || RE_CLOSE.test(line)) { mode = "idle"; continue; }
      const c = rowCells(line, 4);
      if (!c) throw new Error(`bad fusion skill row (${card.name}): ${line}`);
      pushRow(card.rows, c, [0, 1]);
      continue;
    }
  }
  if (groups.length === 0) return null;
  for (const gr of groups) {
    if (!gr.cards) continue;
    gr.cards = gr.cards.map((c) => {
      const d = c.description.slice();
      const dTitle = d.shift() ?? "";
      const out = { title: dTitle || c.name, ...(c.class ? { class: c.class } : {}), sp: c.sp, summary: c.summary };
      if (dTitle && dTitle !== c.name) out.header_name = c.name;
      if (d.length) out.detail = d.join(" ");
      out.columns = ["MP", "Special Skill", "Class", "Description"];
      out.rows = c.rows;
      return out;
    });
  }
  return groups;
}
