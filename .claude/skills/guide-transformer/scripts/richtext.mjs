// richtext.mjs - helpers for structured rich text (string OR array of blocks).
//
// A rich-text field (step description, note/callout text, boss strategy) is either a
// markdown-lite string or an array of blocks:
//
//   [{"text": "Intro"},
//    {"list": "numbered", "items": [{"text": "A", "children": [{"list": "bullet", "items": [{"text": "a1"}]}]}]}]
//
// `flattenText` turns it into markdown-lite lines (2 spaces of indent per nesting level;
// lines are in the depth-first reading order that `choices[].after_item` counts), so the
// lint and QA tools can keep working on plain strings.

/** Returns a markdown-lite string for a block array; anything else is returned unchanged. */
export function flattenText(value) {
  if (!Array.isArray(value)) return value;
  const lines = [];

  const walkList = (lst, level) => {
    (lst.items ?? []).forEach((item, idx) => {
      const mark = lst.list === "numbered" ? `${idx + 1}.` : "-";
      lines.push(`${"  ".repeat(level)}${mark} ${item.text ?? ""}`);
      for (const child of item.children ?? []) walkList(child, level + 1);
    });
  };

  for (const block of value) {
    if ("list" in block) walkList(block, 0);
    else lines.push(block.text ?? "");
  }
  return lines.join("\n");
}

/** Deep copy of `guide` with every rich-text field flattened to a string. */
export function flattenGuide(guide) {
  const g = structuredClone(guide);

  const boss = (b) => {
    if (b && typeof b === "object" && "strategy" in b) b.strategy = flattenText(b.strategy);
  };

  for (const step of g.steps ?? []) {
    if ("description" in step) step.description = flattenText(step.description);
    for (const note of step.notes ?? []) {
      if ("text" in note) note.text = flattenText(note.text);
    }
    boss(step.boss);
  }
  for (const b of g.bosses ?? []) boss(b);
  const single = g.boss;
  for (const x of Array.isArray(single) ? single : [single]) boss(x);
  for (const call of g.callouts ?? []) {
    if ("text" in call) call.text = flattenText(call.text);
  }
  return g;
}

const MD_LIST = /^( *)(?:(-|\*)|(\d+)\.)\s+(\S.*)$/;

/**
 * Inverse of flattenText for nested lists.
 *
 * Returns a block array when `text` has a list line indented under another list line
 * (2 spaces per level, at most 3 levels); otherwise returns `text` unchanged, so flat
 * descriptions stay plain strings. Line order is preserved, so `after_item` anchors keep
 * pointing at the same line.
 */
export function blocksFromMarkdown(text) {
  if (typeof text !== "string" || !text.includes("\n")) return text;
  const parsed = [];
  let nested = false;
  for (const ln of text.split("\n")) {
    const m = MD_LIST.exec(ln);
    if (!m) {
      parsed.push({ tag: "p", level: 0, kind: null, body: ln.trim() });
      continue;
    }
    const indent = m[1].length;
    const level = Math.floor(indent / 2);
    if (level > 2 || indent % 2) return text; // deeper than the schema allows / irregular indent: keep flat
    const kind = m[3] ? "numbered" : "bullet";
    nested = nested || level > 0;
    parsed.push({ tag: "l", level, kind, body: m[4] });
  }
  if (!nested || (parsed[0].tag === "l" && parsed[0].level > 0)) return text;

  const blocks = [];
  const lists = []; // open list per nesting level
  const items = []; // last item per nesting level

  const newList = (level, kind) => {
    const lst = { list: kind, items: [] };
    if (level === 0) blocks.push(lst);
    else (items[level - 1].children ??= []).push(lst);
    return lst;
  };

  for (const { tag, level, kind, body } of parsed) {
    if (tag === "p") {
      lists.length = 0;
      items.length = 0;
      blocks.push({ text: body });
      continue;
    }
    if (level > lists.length) return text; // skipped a level
    lists.length = Math.min(lists.length, level + 1);
    items.length = Math.min(items.length, level);
    if (level === lists.length || lists[level].list !== kind) {
      const lst = newList(level, kind);
      lists.length = level;
      lists.push(lst);
    }
    const item = { text: body };
    lists[level].items.push(item);
    items.push(item);
  }
  return blocks;
}
