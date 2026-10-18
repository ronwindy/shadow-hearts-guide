// Deterministic parser for ASCII "item box" reference pages (a-1-05 Items).
// Shared by the scaffold (builds reference_tables) and QA (rebuilds from the canonical and compares).
//
// Source layout, one box per item (the first box is the column legend, not an item):
//   |  Name               |  Effect (may wrap onto more rows)   | Y |
//   |-----'------'---|
//   |  Name                                                       |   <- description title (repeats the name)
//   |  wrapped description lines ...                              |
//   |____________________________________________________________|

const ws = (s) => s.replace(/\s+/g, " ").trim();

function cells(line) {
  const p = line.split("|");
  return p.length === 5 && p[0] === "" && p[4] === "" && !/^¯+$/.test(p[1]) ? p.slice(1, 4) : null;
}

const isRule = (l) => /^[|']?[—¯_]{4,}/.test(l) || /^\.[—]/.test(l);

/** @returns {{title?: string, intro: string, columns: string[], rows: {cells: string[], detail: string}[]} | null} */
export function parseItemBoxes(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const rows = [];
  const intro = [];
  let legend = null;
  let cur = null;
  let mode = "pre"; // pre | head | desc

  for (const line of lines) {
    if (mode === "pre" || mode === "idle") {
      const c = cells(line);
      if (c && ws(c[0])) {
        cur = { name: ws(c[0]), effect: ws(c[1]), flag: ws(c[2]), detail: [] };
        mode = "head";
        continue;
      }
      if (mode === "pre" && rows.length === 0 && !legend && line.trim() && !/[«»\\]|^\s*_+\s*$|^\s*¯+\s*$|^\s*\[A-/.test(line) && !isRule(line)) {
        intro.push(ws(line));
      }
      continue;
    }
    if (mode === "head") {
      const c = cells(line);
      if (c) {
        if (ws(c[0])) throw new Error(`unexpected second item row inside box (prev ${cur.name}, mode ${mode}): ${line}`);
        cur.effect = ws(`${cur.effect} ${c[1]}`);
        continue;
      }
      if (isRule(line)) { mode = "desc"; continue; }
      throw new Error(`unexpected line in item head: ${line}`);
    }
    if (mode === "desc") {
      if (isRule(line)) {
        if (!legend) legend = cur; else rows.push(cur);
        cur = null;
        mode = "idle";
        continue;
      }
      const m = /^\|(.*)\|$/.exec(line);
      if (!m) throw new Error(`unexpected line in item description: ${line}`);
      const t = ws(m[1]);
      if (t) cur.detail.push(t);
    }
  }
  if (cur) { // final box ends with the closing border, which isRule() catches; guard anyway
    if (!legend) legend = cur; else rows.push(cur);
  }
  if (!legend || rows.length === 0) return null;

  const out = rows.map((r) => {
    const d = r.detail.slice();
    const title = d.shift() ?? ""; // first description line is the item's display name
    const row = { cells: [r.name, r.effect, r.flag === "Y" ? "Yes" : "—"], detail: d.join(" ") };
    if (title && title !== r.name) row.detail_title = title;
    return row;
  });
  return {
    intro: intro.join(" "),
    columns: ["Item", "Effect", "Usable in Command Menu"],
    rows: out,
  };
}
