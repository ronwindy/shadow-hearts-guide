// Regroups a flat boss `strategy` bullet string into labelled multi-level blocks.
// Usage: node scripts/regroup_strategy.mjs <spec.json> [--dry]
// Spec: { "<section-id>": { "<Boss name>": [ { "label": "Threats"|null, "lines": [from, to], "kids": { "4": [5] } } ] } }
// Lines are 0-based indexes of the existing bullets. Wording is never retyped: the script only
// wraps existing items, then verifies the flattened text equals the original before writing.
import fs from "node:fs";
import path from "node:path";

const [specFile, flag] = process.argv.slice(2);
const dry = flag === "--dry";
const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
const dir = "structured-content/sections";

const bullets = (s) => s.split("\n").filter((l) => l.trim()).map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
const flatten = (blocks) => {
  const out = [];
  const walk = (items) => items.forEach((it) => { out.push(it.text); (it.children ?? []).forEach((c) => walk(c.items)); });
  blocks.forEach((b) => (b.list ? walk(b.items) : out.push(b.text)));
  return out;
};

for (const [id, bosses] of Object.entries(spec)) {
  const file = path.join(dir, `${id}.json`);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const g = doc.guide;
  const all = [...(g.bosses ?? []), ...(g.steps ?? []).map((s) => s.boss).filter(Boolean)];
  for (const [name, groups] of Object.entries(bosses)) {
    const targets = all.filter((b) => b.name === name && typeof b.strategy === "string");
    if (!targets.length) throw new Error(`${id}: no flat strategy for ${name}`);
    const src = bullets(targets[0].strategy);
    const mk = (lines) => lines.map((i) => ({ text: src[i] }));
    const blocks = groups.map((grp) => {
      const [a, b] = grp.lines;
      const idx = Array.from({ length: b - a + 1 }, (_, k) => a + k);
      const kidSet = new Set(Object.values(grp.kids ?? {}).flat());
      const items = idx.filter((i) => !kidSet.has(i)).map((i) => {
        const it = { text: src[i] };
        if (grp.kids?.[i]) it.children = [{ list: "bullet", items: mk(grp.kids[i]) }];
        return it;
      });
      return grp.label
        ? { list: "bullet", items: [{ text: `**${grp.label}**`, children: [{ list: "bullet", items }] }] }
        : { list: "bullet", items };
    });
    // Merge consecutive blocks into one top-level list so the parents are siblings.
    const merged = [{ list: "bullet", items: blocks.flatMap((b) => b.items) }];
    const labels = new Set(groups.map((x) => x.label && `**${x.label}**`).filter(Boolean));
    const got = flatten(merged).filter((t) => !labels.has(t));
    if (JSON.stringify(got.slice().sort()) !== JSON.stringify(src.slice().sort()))
      throw new Error(`${id}/${name}: text mismatch (${got.length} vs ${src.length})`);
    const covered = groups.reduce((n, x) => n + x.lines[1] - x.lines[0] + 1, 0);
    if (covered !== src.length) throw new Error(`${id}/${name}: groups cover ${covered} of ${src.length} bullets`);
    targets.forEach((t) => { t.strategy = merged; });
    console.log(`${id} / ${name}: ${src.length} bullets -> ${groups.length} groups, ${targets.length} copies`);
  }
  if (!dry) fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
}
