// Deterministic parsers for the ASCII appendix pages a-1-06 .. a-1-10
// (Valuables, Store/Shop List, Acupuncturist Costs, The Lottery, Malice Rewards).
// Shared by the scaffold (builds reference_tables) and QA (rebuilds from the canonical and compares).
// Every parser returns `reference_tables` ({title?, intro?, columns[], rows:[{cells[], detail*?}]}),
// drops only box-drawing art and keeps every word and number of the source.

const ws = (s) => s.replace(/\s+/g, " ").trim();
const isRule = (l) => /^[|']?[—¯_]{4,}/.test(l) || /^\.[—]/.test(l);
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

/** Parsed tables for the a-1-06..a-1-10 pages; undefined for other ids. */
export function parseAppendixTables(id, text) {
  switch (id) {
    case "a-1-06": return [parseValuableTable(text)];
    case "a-1-07": return parseShopTables(text);
    case "a-1-08": return parseAcupunctureTables(text);
    case "a-1-09": return parseLotteryTables(text);
    case "a-1-10": return [parseMaliceTable(text)];
    default: return undefined;
  }
}
