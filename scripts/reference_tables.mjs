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

// ---------------------------------------------------------------------------------------------
// a-1-02 Weapons: one titled box per character, one weapon row per sub-box:
//   |  Weapon name        |   11 /   9  |   13 /  10  | ... (4 stat cells, P-Atk/S-Atk per A-Lv.)
//   |  Description (Menu): wrapped text                           |
//   |  Description (Info): Display name                           |
//   |                      wrapped text                           |
// Cells keep the source's "P / S" notation (whitespace normalised).

/** @returns {{title: string, intro?: string, columns: string[], rows: {cells: string[], detail_menu: string, detail_title?: string, detail: string}[]}[] | null} */
export function parseWeaponTables(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const tables = [];
  const intro = [];
  let table = null;
  let cur = null;
  let field = null; // "menu" | "info"
  const flush = () => {
    if (!cur) return;
    const info = cur.info.slice();
    const title = info.shift() ?? "";
    const row = { cells: cur.cells, detail_menu: cur.menu.join(" "), detail: info.join(" ") };
    if (title && title !== cur.cells[0]) row.detail_title = title;
    table.rows.push(row);
    cur = null;
    field = null;
  };

  for (const line of lines) {
    const hdr = /^\|\s{2,}([A-Z][A-Za-z]+)\s+\|\s*$/.exec(line);
    if (hdr) {
      flush();
      table = { title: ws(hdr[1]), columns: [], rows: [] };
      tables.push(table);
      continue;
    }
    if (!table) {
      if (tables.length === 0 && line.trim() && !/[«»\\]|^\s*_+\s*$|^\s*¯+\s*$|^\s*\[A-/.test(line) && !isRule(line)) intro.push(ws(line));
      continue;
    }
    const p = line.split("|");
    if (p.length === 7 && p[0] === "" && p[6] === "") {
      const c = p.slice(1, 6).map(ws);
      if (/^A-Lv\./.test(c[1])) { table.columns = ["Weapon", ...c.slice(1).map((h) => h + " (P-Atk/S-Atk)")]; continue; }
      if (c[1] === "P-Atk/S-Atk" || /^[=—¯]+$/.test(c[1])) continue;
      if (c[0] && /^-?\d+ \/ -?\d+$/.test(c[1])) {
        flush();
        cur = { cells: c, menu: [], info: [] };
        continue;
      }
      throw new Error(`unexpected stat line: ${line}`);
    }
    if (!cur || isRule(line)) continue;
    const m = /^\|(.*)\|$/.exec(line);
    if (!m) continue; // closing border
    const t = ws(m[1]);
    if (!t) continue;
    if (/^Description \(Menu\):/.test(t)) { field = "menu"; cur.menu.push(t.replace(/^Description \(Menu\):\s*/, "")); }
    else if (/^Description \(Info\):/.test(t)) { field = "info"; cur.info.push(t.replace(/^Description \(Info\):\s*/, "")); }
    else if (field === "menu") cur.menu.push(t);
    else if (field === "info") cur.info.push(t);
    else throw new Error(`unexpected line in weapon box: ${line}`);
  }
  flush();
  if (tables.length === 0 || tables.some((t) => t.rows.length === 0)) return null;
  tables[0].intro = intro.join(" ");
  return tables;
}
