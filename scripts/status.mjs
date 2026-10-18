// status.mjs - Project status summary and QA-result store.
//
// Used by the `status` and `check` subcommands. The CLI lives in guide.mjs.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMerges } from "../.claude/skills/qa/scripts/merges.mjs";
import { PROJECT } from "./project_config.mjs";

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const QA_STATUS_FILE = "qa-status.json";

/** JSON in the shape Python's json.dumps(indent=2) produces; sortKeys/ensureAscii mirror its flags. */
export function pyJson(value, { sortKeys = false, ensureAscii = false } = {}) {
  const normalize = (v) => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") {
      const keys = Object.keys(v);
      if (sortKeys) keys.sort();
      const out = {};
      for (const k of keys) out[k] = normalize(v[k]);
      return out;
    }
    return v;
  };
  let text = JSON.stringify(normalize(value), null, 2);
  if (ensureAscii) text = text.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return text;
}

export function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

export function loadCanonicalIndex(root = ROOT_DIR) {
  const path = join(root, "canonical-sources", PROJECT.canonicalIndexFile);
  if (!existsSync(path)) throw new Error(`Canonical manifest not found: ${path}`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  return { source: data.source ?? {}, sections: data.sections_index ?? [] };
}

export function loadQaStatus(root = ROOT_DIR) {
  const path = join(root, QA_STATUS_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** Local time as YYYY-MM-DDTHH:MM:SS (Python isoformat(timespec="seconds") without offset). */
function localIso(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Local time as YYYY-MM-DD HH:MM:SS. */
function localStamp(date = new Date()) {
  return localIso(date).replace("T", " ");
}

/** Persists a section's QA result, tied to the structured file's content hash. */
export function recordQaResult(root, secId, structuredPath, status, summary) {
  const data = loadQaStatus(root);
  const prev = data[secId] ?? {};
  const hash = fileHash(structuredPath);
  if (prev.status === status && pyJson(prev.summary ?? null, { sortKeys: true }) === pyJson(summary, { sortKeys: true })
      && prev.content_hash === hash) {
    return; // same result for the same content: keep checked_at so reruns do not churn the diff
  }
  data[secId] = { status, summary, content_hash: hash, checked_at: localIso() };
  writeFileSync(join(root, QA_STATUS_FILE), pyJson(data, { sortKeys: true, ensureAscii: true }) + "\n", "utf8");
}

export function auditSection(root, sec, qaData = {}) {
  const secId = sec.id ?? "";
  const relFile = sec.file ?? "";
  const filename = relFile ? relFile.split(/[\\/]/).pop() : `${secId}.json`;
  const structuredPath = join(root, "structured-content", "sections", filename);

  const canonicalOk = existsSync(join(root, "canonical-sources", relFile));
  const structuredOk = existsSync(structuredPath);
  const webBuilt = [
    join(root, "dist", `${secId}.html`),
    join(root, "dist", "guide", `${secId}.html`),
    join(root, "dist", "guide", secId, "index.html"),
  ].some((p) => existsSync(p));

  // A stored QA result only counts while the structured file is unchanged since QA ran.
  let qaStatus = "NONE";
  const entry = qaData[secId];
  if (entry && structuredOk && entry.content_hash === fileHash(structuredPath)) {
    qaStatus = String(entry.status ?? "").startsWith("PASS") ? "PASS" : "FAIL";
  }

  let state;
  if (!canonicalOk) state = "MISSING_CANONICAL";
  else if (!structuredOk) state = "NOT_STRUCTURED";
  else if (qaStatus === "NONE") state = "STRUCTURED_PENDING_QA";
  else if (qaStatus === "FAIL") state = "QA_ISSUES";
  else if (!webBuilt) state = "QA_PASSED";
  else state = "WEB_BUILT";

  return {
    id: secId,
    code: sec.code ?? "",
    title: sec.title ?? "",
    category: sec.category ?? "Other",
    canonical: canonicalOk,
    structured: structuredOk,
    qa_status: qaStatus,
    web_built: webBuilt,
    state,
  };
}

export function computeProjectStatus(root = ROOT_DIR) {
  const { sections: sectionsIndex } = loadCanonicalIndex(root);
  const qaData = loadQaStatus(root);
  // Sections whose content was merged into another page are listed in structured-content/merges.json.
  const merged = new Set(Object.keys(loadMerges(root)));
  const sections = sectionsIndex.filter((s) => !merged.has(s.id)).map((s) => auditSection(root, s, qaData));
  const total = sections.length;
  const count = (pred) => sections.filter(pred).length;

  const ref = (s) => ({ id: s.id, title: s.title, code: s.code });
  const metrics = {
    total,
    canonical: count((s) => s.canonical),
    structured: count((s) => s.structured),
    qa_pass: count((s) => s.qa_status === "PASS"),
    qa_fail: count((s) => s.qa_status === "FAIL"),
    web: count((s) => s.web_built),
  };

  const walk = sections.filter((s) => s.category.startsWith("Walkthrough"));
  let lastStructured = -1;
  walk.forEach((s, i) => { if (s.structured) lastStructured = i; });
  const gaps = walk.slice(0, Math.max(0, lastStructured)).filter((s) => !s.structured).map(ref);
  const failing = sections.filter((s) => s.qa_status === "FAIL").map(ref);
  const pendingQa = sections.filter((s) => s.structured && s.qa_status === "NONE").map(ref);
  const nextSection = walk.find((s) => !s.structured);

  // Priority order from CLAUDE.md: sequence gaps -> QA FAILs -> pending QA -> next section.
  const priorities = [];
  if (gaps.length) priorities.push(`Structure ${gaps[0].id} (${gaps[0].title}) - sequence gap`);
  if (failing.length) priorities.push(`Fix QA FAIL in ${failing[0].id} (${failing[0].title})`);
  if (pendingQa.length) priorities.push(`Run QA on ${pendingQa[0].id} (${pendingQa[0].title})`);
  if (nextSection && !gaps.length) {
    priorities.push(`Structure ${nextSection.id} (${nextSection.title}) - next chronological`);
  }

  return {
    timestamp: localStamp(),
    metrics,
    priorities,
    sequence_gaps: gaps,
    qa_failures: failing,
    pending_qa: pendingQa,
    sections,
  };
}

export function renderCompactSummary(data) {
  const m = data.metrics;
  const t = m.total;
  const lines = [
    `=== PROJECT STATUS (${data.timestamp}) ===`,
    `Canonical ${m.canonical}/${t} | Structured ${m.structured}/${t} | ` +
      `QA pass ${m.qa_pass}/${t} (fail ${m.qa_fail}) | Web built ${m.web}/${t}`,
    "Next:",
  ];
  if (data.priorities.length) {
    data.priorities.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  } else {
    lines.push("  (nothing pending)");
  }
  if (data.sequence_gaps.length) lines.push("Sequence gaps: " + data.sequence_gaps.map((g) => g.id).join(", "));
  if (data.qa_failures.length) lines.push("QA FAIL:       " + data.qa_failures.map((f) => f.id).join(", "));
  if (data.pending_qa.length) lines.push("Pending QA:    " + data.pending_qa.map((p) => p.id).join(", "));
  return lines.join("\n");
}

/** STATUS.md: summary block first (<45 lines), then the full section matrix. */
export function generateStatusMarkdown(data) {
  const lines = [
    `# ${PROJECT.statusTitle}`,
    "",
    `> Last synced: \`${data.timestamp}\``,
    "",
    "```text",
    renderCompactSummary(data),
    "```",
    "",
    "## Section Matrix",
    "",
    "| Code | ID | Title | Category | State |",
    "| :-- | :-- | :-- | :-- | :-- |",
  ];
  for (const s of data.sections) {
    lines.push(`| \`${s.code}\` | \`${s.id}\` | ${s.title} | ${s.category} | ${s.state} |`);
  }
  lines.push("");
  return lines.join("\n");
}

/** Writes STATUS.md unless only the timestamps differ. Returns true when the file changed. */
export function writeStatusMarkdown(root, data) {
  const path = join(root, "STATUS.md");
  const content = generateStatusMarkdown(data);
  const mask = (t) => t.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, "<ts>");
  if (existsSync(path) && mask(readFileSync(path, "utf8")) === mask(content)) return false;
  writeFileSync(path, content, "utf8");
  return true;
}
