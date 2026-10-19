// Deterministic parsers for every appendix page with ASCII-box or table source (a-1-02 .. a-1-10).
// Shared by the scaffold (builds reference_tables) and QA (rebuilds from the canonical and compares).
// One entry point: parseReferenceTables(id, text) returns the table model in the shape
//   reference_tables: [{ title?, intro?, columns[], rows: [{ cells[], description?: { menu?, title?, text? } }] }]
// Parsers drop only box-drawing art and keep every word and number of the source.

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

// ---------------------------------------------------------------------------------------------
// a-1-03 Armor / a-1-04 Accessories: one legend box (column titles), then one box per item:
//   |  Name  |  stat cells ...  |  last column  |
//   |  Description (Menu): text                 |
//   |  Description (Info): Display name         |
//   |                      wrapped text         |
// A stray "||" inside a description line (source typo, line break lost) is treated as a line break.

/** @returns {{intro: string, columns: string[], rows: {cells: string[], detail_menu: string, detail_title?: string, detail: string}[]} | null} */
export function parseGearTable(text) {
  const lines = String(text ?? "").split(/\r?\n/).flatMap((l) => (/^\|.*\S.*\|\|.*\S.*\|$/.test(l) ? l.replace(/\|\|/, "|\n|").split("\n") : [l]));
  const intro = [];
  let columns = null;
  const rows = [];
  let cur = null;
  let field = null;
  const flush = () => {
    if (!cur) return;
    const info = cur.info.slice();
    const title = info.shift() ?? "";
    const row = { cells: cur.cells, detail_menu: cur.menu.join(" "), detail: info.join(" ") };
    if (title && title !== cur.cells[0]) row.detail_title = title;
    rows.push(row);
    cur = null;
    field = null;
  };
  for (const line of lines) {
    const p = line.split("|");
    const isCellRow = p.length >= 5 && p[0] === "" && p[p.length - 1] === "" && ws(p[1]) && !/^[—¯_]+$/.test(ws(p[1]));
    if (isCellRow && (!columns || p.length - 2 === columns.length) && !/^Description \(/.test(ws(p[1]))) {
      const c = p.slice(1, -1).map(ws);
      if (!columns) { columns = c; continue; }
      flush();
      cur = { cells: c, menu: [], info: [] };
      continue;
    }
    if (!columns) {
      if (line.trim() && !/[«»\\]|^\s*_+\s*$|^\s*¯+\s*$|^\s*\[A-/.test(line) && !isRule(line)) intro.push(ws(line));
      continue;
    }
    if (!cur || isRule(line)) continue;
    const m = /^\|(.*)\|$/.exec(line);
    if (!m) continue;
    const t = ws(m[1]);
    if (!t) continue;
    if (/^Description \(Menu\):/.test(t)) { field = "menu"; cur.menu.push(t.replace(/^Description \(Menu\):\s*/, "")); }
    else if (/^Description \(Info\):/.test(t)) { field = "info"; cur.info.push(t.replace(/^Description \(Info\):\s*/, "")); }
    else if (field === "menu") cur.menu.push(t);
    else if (field === "info") cur.info.push(t);
    else throw new Error(`unexpected line in gear box: ${line}`);
  }
  flush();
  if (!columns || rows.length === 0) return null;
  return { intro: intro.join(" "), columns, rows };
}

const HEADER_ART = /[«»\\]|^\s*_+\s*$|^\s*¯+\s*$|^\s*\[A-/;
const isIntroLine = (l) => l.trim() && !HEADER_ART.test(l) && !isRule(l);

/** a-1-06 Valuables: one 2-cell box per valuable (name | menu text), then the Info title + wrapped description. */
export function parseValuableTable(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro = [];
  const rows = [];
  let legend = null;
  let cur = null;
  let mode = "pre";
  const p2 = (l) => {
    const p = l.split("|");
    return p.length === 4 && p[0] === "" && p[3] === "" && !/^[—¯_]+$/.test(ws(p[1])) ? [ws(p[1]), ws(p[2])] : null;
  };
  const done = () => {
    if (!legend) legend = cur; else rows.push(cur);
    cur = null;
    mode = "idle";
  };
  for (const line of lines) {
    if (mode === "pre" || mode === "idle") {
      const c = p2(line);
      if (c && c[0] && c[1]) { cur = { cells: c, detail: [] }; mode = "head"; continue; }
      if (mode === "pre" && rows.length === 0 && !legend && isIntroLine(line)) intro.push(ws(line));
      continue;
    }
    if (mode === "head") {
      const c = p2(line);
      if (c && !c[0] && c[1]) { cur.cells[1] = ws(`${cur.cells[1]} ${c[1]}`); continue; }
      if (isRule(line)) { mode = "desc"; continue; }
      throw new Error(`unexpected line in valuable head: ${line}`);
    }
    if (isRule(line)) { done(); continue; }
    const m = /^\|(.*)\|$/.exec(line);
    if (!m) throw new Error(`unexpected line in valuable description: ${line}`);
    const t = ws(m[1]);
    if (t) cur.detail.push(t);
  }
  if (cur) done();
  if (!legend || rows.length === 0) return null;
  return {
    intro: intro.join(" "),
    columns: legend.cells,
    rows: rows.map((r) => {
      const d = r.detail.slice();
      const title = d.shift() ?? "";
      const row = { cells: r.cells, detail: d.join(" ") };
      if (title && title !== r.cells[0]) row.detail_title = title;
      return row;
    }),
  };
}

/** a-1-10 Malice Rewards: two side-by-side halves of one Malice | Prize table (left half, then right half). */
export function parseMaliceTable(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro = [];
  const left = [];
  const right = [];
  let columns = null;
  for (const line of lines) {
    const p = line.split("|");
    if (p.length === 7 && !p[0].trim() && p[6] === "" && !/^=+$/.test(p[1].trim())) {
      const c = p.map(ws);
      if (!columns) { columns = [c[1], c[2]]; continue; }
      if (c[1] || c[2]) left.push([c[1], c[2]]);
      if (c[4] || c[5]) right.push([c[4], c[5]]);
      continue;
    }
    if (/^\s*[.'|=—]/.test(line)) continue;
    if (!columns && isIntroLine(line)) intro.push(ws(line));
    else if (columns && line.trim()) throw new Error(`unexpected line after malice table: ${line}`);
  }
  if (!columns || left.length === 0) return null;
  return { intro: intro.join(" "), columns, rows: [...left, ...right].map((cells) => ({ cells })) };
}

/** a-1-07 Store/Shop List: one table per shop (title "Location: Shop"); left column then right column. */
export function parseShopTables(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const tables = [];
  const intro = [];
  let location = "";
  let table = null;
  let right = [];
  const item = (s) => {
    const t = ws(s);
    if (!t) return null;
    const m = /^(.+?)\s+-\s+(\d+)$/.exec(t);
    if (!m) throw new Error(`unexpected shop cell: ${s}`);
    return [m[1], m[2]];
  };
  const flush = () => {
    if (table) { table.rows.push(...right.map((cells) => ({ cells }))); table = null; right = []; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\.[—]{4,}\.\s*$/.test(line)) continue;
    const t = /^\s*\|\s*-\$-\s+(.+?)\s+-\$-\s*\|\s*$/.exec(line);
    if (t) {
      flush();
      table = { title: `${location}: ${t[1]}`, columns: ["Item", "Price"], rows: [] };
      tables.push(table);
      continue;
    }
    const p = line.split("|");
    if (table && p.length === 4 && p[0].trim() === "" && p[3] === "" && !/^[=v—]+$/.test(ws(p[1]).replace(/\s/g, ""))) {
      const l = item(p[1]);
      const r = item(p[2]);
      if (l) table.rows.push({ cells: l });
      if (r) right.push(r);
      continue;
    }
    if (/^\s*[|'.]/.test(line)) { if (/^\s*'/.test(line)) flush(); continue; }
    if (!isIntroLine(line)) continue;
    const next = lines.slice(i + 1).find((l) => l.trim());
    if (next && /^\s*\.[—]{4,}\./.test(next)) location = ws(line);
    else if (!tables.length) intro.push(ws(line));
    else throw new Error(`unexpected line in shop list: ${line}`);
  }
  flush();
  if (!tables.length || tables.some((x) => x.rows.length === 0)) return null;
  tables[0].intro = intro.join(" ");
  return tables;
}

/** a-1-08 Acupuncturist Costs: one table per character; one row per weapon with its Atk/Hit step costs. */
export function parseAcupunctureTables(text) {
  const lines = String(text ?? "").split(/\r?\n/).flatMap((l) => (/.\|\|/.test(l) ? l.replace("||", "|\n|").split("\n") : [l]));
  const intro = [];
  const tables = [];
  let table = null;
  let cur = null;
  let names = null;
  const flush = () => {
    if (cur) { table.rows.push({ cells: [cur.name, cur.total, ...cur.steps.map((s) => s[1])] }); cur = null; }
  };
  for (const line of lines) {
    const ch = /^\|\s+([A-Z][A-Za-z]+)\s+\|\s*$/.exec(line);
    if (ch) { flush(); table = { title: ws(ch[1]), columns: [], rows: [] }; tables.push(table); continue; }
    if (!table) { if (isIntroLine(line)) intro.push(ws(line)); continue; }
    const w = /^\|\s+(.+?)\s+Grand Total:\s+(\d+)\s*\|\s*$/.exec(line);
    if (w) { flush(); cur = { name: ws(w[1]), total: w[2], steps: [] }; continue; }
    const p = line.split("|");
    if (cur && p.length === 10 && p[0] === "" && p[9] === "" && !/^_+$/.test(ws(p[1]))) {
      const c = p.map(ws);
      cur.steps.push([c[1], c[2]], [c[3], c[4]], [c[5], c[6]], [c[7], c[8]]);
      if (!names) names = [];
      if (names.length < 8) names.push(c[1], c[3], c[5], c[7]);
      continue;
    }
    if (/^\s*[|'.]/.test(line) || !line.trim()) continue;
    throw new Error(`unexpected line in acupuncture costs: ${line}`);
  }
  flush();
  if (!tables.length || tables.some((t) => t.rows.length === 0)) return null;
  for (const t of tables) t.columns = ["Weapon", "Grand Total", ...(names ?? [])];
  tables[0].intro = intro.join(" ");
  return tables;
}

/** a-1-09 The Lottery: a ticket-location table, then one prize table per Lottery Member (Location + notes as intro). */
export function parseLotteryTables(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro = [];
  const tickets = { title: "Lottery Ticket Locations", columns: ["Ticket", "Location"], rows: [] };
  const tables = [tickets];
  let member = null;
  let notes = [];
  const endMember = () => {
    if (member) { member.intro = ws(notes.join(" ")); notes = []; }
  };
  for (const line of lines) {
    const tk = /^Lottery Ticket #(\d+) - (.+)$/.exec(line.trim());
    if (tk) { tickets.rows.push({ cells: [`#${tk[1]}`, ws(tk[2])] }); continue; }
    const mh = /\[_LOTTERY MEMBER NO\. (\d+)_\]/.exec(line);
    if (mh) {
      endMember();
      member = { title: `Lottery Member No. ${mh[1]}`, columns: ["Color", "Prize"], rows: [] };
      tables.push(member);
      continue;
    }
    if (!/[A-Za-z0-9]/.test(line)) continue;
    if (/^\s*Lottery (Ticket|Member) Locations/.test(line)) continue;
    const pr = /^[\s\\/]*\((\w+)\)\s+\|\s+(.+?)\s*[\\/]?\s*$/.exec(line);
    if (pr && member && !notes.length) { member.rows.push({ cells: [pr[1], ws(pr[2])] }); continue; }
    if (!member) { if (isIntroLine(line)) intro.push(ws(line)); continue; }
    notes.push(ws(line));
  }
  endMember();
  if (!tickets.rows.length || tables.slice(1).some((t) => t.rows.length === 0)) return null;
  tickets.intro = intro.join(" ");
  return tables;
}

/** a-1-11 Pedometer Rewards: one "Item | Price" table; two-column item rows (left, then right), then a footer row whose price keeps its qualifier. */
export function parsePedometerTable(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro = [];
  const rows = [];
  let title = null;
  const pair = (s) => {
    const m = /^\s*(.+?)\s+-\s+(.+?)\s*$/.exec(s);
    if (!m) throw new Error(`unexpected pedometer cell: ${s}`);
    return [ws(m[1]), ws(m[2])];
  };
  const right = [];
  const footer = [];
  for (const line of lines) {
    const t = /^\s*\|\s*-\$-\s+(.+?)\s+-\$-\s*\|\s*$/.exec(line);
    if (t) { title = ws(t[1]); continue; }
    const p = line.split("|");
    if (title && p.length === 4 && p[0].trim() === "" && p[3] === "" && / - /.test(line)) {
      if (p[1].trim()) rows.push(pair(p[1]));
      if (p[2].trim()) right.push(pair(p[2]));
      continue;
    }
    if (title && p.length === 3 && p[0].trim() === "" && p[2].trim() === "" && / - /.test(line)) {
      if (p[1].trim()) footer.push(pair(p[1]));
      continue;
    }
    if (/^\s*[|'.=v—]/.test(line) || /^\s*'/.test(line)) continue;
    if (!title && isIntroLine(line)) intro.push(ws(line).replace(/\[_(.+?)_\]/g, "$1"));
  }
  if (!title || rows.length + right.length + footer.length === 0) return null;
  return [{
    title,
    intro: intro.join(" "),
    columns: ["Item", "Price"],
    rows: [...rows, ...right, ...footer].map((cells) => ({ cells })),
  }];
}

/** a-1-12 NPC Library: one row per entry (No. | Name | Class), its description box as the row description. */
export function parseNpcTable(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const intro = [];
  const rows = [];
  let cur = null;
  for (const line of lines) {
    const p = line.split("|");
    if (p.length === 5 && p[0] === "" && p[4] === "" && /\S/.test(p[1]) && !/^[—¯_]+$/.test(ws(p[1]))) {
      cur = { cells: [ws(p[1]), ws(p[2]), ws(p[3])], text: [] };
      rows.push(cur);
      continue;
    }
    if (/^\s*[.'—]/.test(line) || /^\s*!+\s*$/.test(line)) continue;
    if (p.length === 3 && p[0] === "" && p[2] === "" && cur) {
      if (ws(p[1])) cur.text.push(ws(p[1]));
      continue;
    }
    if (!cur && isIntroLine(line)) intro.push(ws(line));
  }
  if (!rows.length) return null;
  return [{
    intro: intro.join(" "),
    columns: ["No.", "Name", "Class"],
    rows: rows.map((r) => ({ cells: r.cells, ...(r.text.length ? { description: { text: r.text.join(" ") } } : {}) })),
  }];
}

/**
 * a-1-13 Monster Library (Bestiary): one row per monster (No. | Name | HP | Class). Its description box
 * (incl. the Locations and "*Inflicts" lines) is the row description; its formation table is one child table.
 * A formation row whose first cell is blank continues the previous row's wrapped drops.
 */
export function parseBestiaryTable(text) {
  // A stray "||" marks a lost line break in the source (formation header runs into its rule).
  const lines = String(text ?? "").split(/\r?\n/).flatMap((l) => (/.\|\|/.test(l) ? l.replace("||", "|\n|").split("\n") : [l]));
  const intro = [];
  const rows = [];
  let cur = null;
  let child = null;
  let mode = "pre"; // pre | desc | forms
  for (const line of lines) {
    const p = line.split("|");
    const head = p.length === 6 && p[0] === "" && p[5] === "" ? p.slice(1, 5).map(ws) : null;
    if (head && /^No\.\s+\d+$/.test(head[0])) {
      cur = { cells: [head[0].replace(/^No\.\s+/, ""), head[1], head[2], head[3]], text: [], forms: null };
      rows.push(cur);
      mode = "desc";
      continue;
    }
    if (mode === "pre") {
      if (isIntroLine(line)) intro.push(ws(line));
      continue;
    }
    if (/^\s*'/.test(line)) { mode = "pre"; continue; } // closing border of a monster
    if (/^\s*\.[—]/.test(line)) continue; // top border before a header
    if (/^\|[—=]/.test(line)) {
      // "." in the border starts the formation table; "'" alone just closes the header box.
      if (mode === "desc" && line.includes(".")) {
        mode = "forms";
        child = { columns: ["Enemy Formations", "EXP", "Cash", "Possible Item Drops"], rows: [] };
        cur.children = [child];
      }
      continue;
    }
    if (mode === "desc") {
      // A monster with no formation table closes its description box on the last text line.
      const close = /^\|(.*)\|'[—]+'$/.exec(line);
      if (close) { if (ws(close[1])) cur.text.push(ws(close[1])); mode = "pre"; continue; }
      if (p.length === 3 && p[0] === "" && p[2] === "") { if (ws(p[1])) cur.text.push(ws(p[1])); continue; }
      throw new Error(`unexpected line in bestiary description: ${line}`);
    }
    if (mode === "forms") {
      if (p.length === 6 && p[0] === "") {
        const c = p.slice(1, 5).map(ws);
        if (c[0] === "Enemy Formations") continue;
        if (!c[0]) {
          const prev = child.rows[child.rows.length - 1];
          if (!prev) throw new Error(`formation continuation without a row: ${line}`);
          prev.cells[3] = ws(`${prev.cells[3]} ${c[3]}`.trim());
          continue;
        }
        child.rows.push({ cells: c });
        continue;
      }
      if (/^\s*$/.test(line)) continue;
      throw new Error(`unexpected line in bestiary formations: ${line}`);
    }
  }
  if (!rows.length) return null;
  const out = rows.map((r) => ({
    cells: r.cells,
    ...(r.text.length ? { description: { text: r.text.join(" ") } } : {}),
    ...(r.children ? { children: r.children } : {}),
  }));
  return [{ intro: intro.join(" "), columns: ["No.", "Name", "HP", "Class"], rows: out }];
}

/**
 * a-1-14 boss records: canonical `bosses` with each strategy's hard-wrapped source lines joined into one paragraph.
 * Only the line breaks change; every word and number is kept.
 */
export function referenceBosses(bosses) {
  return (bosses ?? []).map((b) => (typeof b.strategy === "string" ? { ...b, strategy: b.strategy.replace(/\s*\n\s*/g, " ").trim() } : b));
}

/**
 * a-1-15 Help: one titled block per HELP section (`Operation (HELP-1)` ...). Each underlined subhead becomes a bold
 * line; wrapped source lines join into paragraphs; the index bullets of the intro stay list items.
 * @returns {{title?: string, text: string}[]}
 */
export function parseHelpBlocks(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const isUnder = (l) => /^\s*[¯_]+\s*$/.test(l);
  const isBanner = (l) => /[«»\\]/.test(l) || /^\s*_+\s*$/.test(l) || /^\s*¯+\s*$/.test(l);
  const blocks = [];
  let cur = { entries: [] };
  let para = [];
  const add = (entry, bullet = false) => {
    const last = cur.entries[cur.entries.length - 1];
    if (bullet && last?.startsWith("- ")) cur.entries[cur.entries.length - 1] = `${last}\n${entry}`;
    else cur.entries.push(entry);
  };
  const flush = () => { if (para.length) { add(ws(para.join(" "))); para = []; } };
  blocks.push(cur);
  let bulletOpen = false; // a bullet's wrapped lines are indented past the bullet marker
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hdr = /^\s+(.+?) \((HELP-\d)\)\s*$/.exec(line);
    if (hdr && isUnder(lines[i + 1] ?? "")) {
      flush();
      cur = { title: `${ws(hdr[1])} (${hdr[2]})`, entries: [] };
      blocks.push(cur);
      bulletOpen = false;
      i++;
      continue;
    }
    if (isBanner(line) || isUnder(line)) continue;
    if (!line.trim()) { flush(); bulletOpen = false; continue; }
    if (bulletOpen && /^\s{8,}\S/.test(line)) {
      cur.entries[cur.entries.length - 1] += ` ${ws(line)}`;
      continue;
    }
    bulletOpen = false;
    if (/^\s*-\s+\S/.test(line)) { flush(); add(`- ${ws(line.replace(/^\s*-\s+/, ""))}`, true); bulletOpen = true; continue; }
    if (/^\s+\S/.test(line) && isUnder(lines[i + 1] ?? "")) { flush(); add(`**${ws(line)}**`); i++; continue; }
    para.push(ws(line));
  }
  flush();
  return blocks
    .filter((b) => b.entries.length)
    .map((b) => ({ ...(b.title ? { title: b.title } : {}), text: b.entries.join("\n\n") }));
}

/** a-1-14 intro: the prose lines above the first box (boss records themselves come from canonical `bosses`). */
export function parseIntroText(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^\s*[./|]/.test(line) && /[—]/.test(line)) break;
    if (isIntroLine(line) && !/^\s*!+\s*$/.test(line)) out.push(ws(line));
  }
  return out.join(" ");
}

/** Row -> model row: the three detail fields become one optional `description` object. */
function toModelRow(r) {
  const description = {};
  if (r.detail_menu) description.menu = r.detail_menu;
  if (r.detail_title) description.title = r.detail_title;
  if (r.detail) description.text = r.detail;
  const { detail, detail_menu, detail_title, ...rest } = r;
  return Object.keys(description).length ? { ...rest, description } : rest;
}

/** Dispatch table: every page whose canonical source is ASCII boxes or tables -> reference_tables (model shape). */
const PARSERS = {
  "a-1-02": (t) => parseWeaponTables(t),
  "a-1-03": (t) => [parseGearTable(t)],
  "a-1-04": (t) => [parseGearTable(t)],
  "a-1-05": (t) => [parseItemBoxes(t)],
  "a-1-06": (t) => [parseValuableTable(t)],
  "a-1-07": (t) => parseShopTables(t),
  "a-1-08": (t) => parseAcupunctureTables(t),
  "a-1-09": (t) => parseLotteryTables(t),
  "a-1-10": (t) => [parseMaliceTable(t)],
  "a-1-11": (t) => parsePedometerTable(t),
  "a-1-12": (t) => parseNpcTable(t),
  "a-1-13": (t) => parseBestiaryTable(t),
};

/** @returns {object[] | null} reference_tables in the model shape; null when the page has no table parser or the text does not parse. */
export function parseReferenceTables(id, text) {
  const parse = PARSERS[id];
  if (!parse) return null;
  const tables = parse(String(text ?? ""));
  if (!tables || tables.some((t) => !t)) return null;
  return tables.map((t) => ({ ...t, rows: t.rows.map(toModelRow) }));
}

/** Ids handled by parseReferenceTables. */
export const TABLE_PAGE_IDS = Object.keys(PARSERS);
