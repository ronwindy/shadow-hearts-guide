// pipeline.mjs - Per-section pipeline actions: scaffold, validate, lint, QA, verdict, finalize, check.
//
// The CLI in guide.mjs parses arguments and calls these functions.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ROOT_DIR, loadQaStatus, recordQaResult, auditSection, computeProjectStatus,
  renderCompactSummary, writeStatusMarkdown, pyJson, loadCanonicalIndex } from "./status.mjs";
import { loadMerges, navigationProblems } from "../.claude/skills/qa/scripts/merges.mjs";
import { getSectionPaths, getCanonicalManifest } from "./sections.mjs";
import { boldFile, buildDictionary, compilePattern } from "./bold_terms.mjs";
import { scaffoldGuide } from "../.claude/skills/guide-transformer/scripts/scaffold_structured_guide.mjs";
import { lintGuide } from "../.claude/skills/guide-transformer/scripts/lint_guide.mjs";
import { getValidator, validateFile, validateInstance, compileSchemaFile } from "../.claude/skills/guide-transformer/scripts/validate_guide.mjs";
import { verifyGuide, formatMarkdownReport } from "../.claude/skills/qa/scripts/verify_guide.mjs";

const rel = (p) => relative(ROOT_DIR, p);
const short = (text, limit = 90) => {
  const s = String(text ?? "").split(/\s+/).filter(Boolean).join(" ");
  return s.length <= limit ? s : `${s.slice(0, limit - 3)}...`;
};
const schemaPath = join(ROOT_DIR, ".claude", "skills", "guide-transformer", "schemas", "structured-guide.schema.json");
const verdictSchemaPath = join(ROOT_DIR, ".claude", "skills", "qa", "schemas", "qa-verdict.schema.json");
const structuredSha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Writes the full QA report to qa-reports/<id>.md (+ .json) and returns the markdown path. */
function saveQaReport(sectionId, report) {
  const outDir = join(ROOT_DIR, "qa-reports");
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, `${sectionId}.md`);
  writeFileSync(mdPath, formatMarkdownReport(report) + "\n", "utf8");
  writeFileSync(join(outDir, `${sectionId}.json`), pyJson(report) + "\n", "utf8");
  return mdPath;
}

/** Scaffolds a structured guide JSON draft from the canonical source text. */
export function runScaffold(sec, force = false) {
  const { canonicalPath, structuredPath } = getSectionPaths(sec);
  console.log(`\n--- [1/1] Scaffolding: ${sec.id} (${sec.title}) ---`);
  if (!existsSync(canonicalPath)) {
    console.log(`[FAIL] Canonical file not found: ${canonicalPath}`);
    return false;
  }
  if (existsSync(structuredPath) && !force) {
    console.log(`[WARN] Structured file already exists: ${structuredPath}`);
    console.log("Use --force to overwrite if desired.");
    return true;
  }
  try {
    const scaffolded = scaffoldGuide(canonicalPath);
    mkdirSync(join(structuredPath, ".."), { recursive: true });
    writeFileSync(structuredPath, pyJson(scaffolded) + "\n", "utf8");
    console.log(`[PASS] Successfully scaffolded: ${rel(structuredPath)}`);
    reportScaffoldWarnings(sec, scaffolded);
    return true;
  } catch (e) {
    console.log(`[FAIL] Scaffolding failed: ${e.message}`);
    return false;
  }
}

/** Flags a scaffold that probably needs a hand-written patch (fragments, guessed step types). */
function reportScaffoldWarnings(sec, scaffolded) {
  const guide = scaffolded.guide ?? {};
  const warns = lintGuide(guide).filter((f) => f.severity === "warn" && ["fragment", "mixed-list"].includes(f.check));
  for (const f of warns) console.log(`  [WARN] ${f.check.padEnd(10)} ${f.location}: ${f.text}`);
  const guessed = (guide.steps ?? [])
    .filter((st) => st.type === "exploration" || (st.type === "battle" && !st.encounter && !st.boss))
    .map((st) => String(st.id));
  if (guessed.length) {
    console.log("  [WARN] low-confidence step type (fallback 'exploration' or 'battle' with no encounter): " +
      `step(s) ${guessed.join(", ")} - confirm the type against the source`);
  }
  if (warns.length) {
    console.log(`  [WARN] ${sec.id}: scaffold has fragments; compare with the canonical text and fix via ` +
      "`node scripts/guide.mjs patch` (arrays replace) before QA.");
  }
}

/** Validates structured guide JSON against the JSON Schema. */
export function runValidate(sec) {
  const { structuredPath } = getSectionPaths(sec);
  console.log(`\n--- Schema Validation: ${sec.id} ---`);
  if (!existsSync(structuredPath)) {
    console.log(`[FAIL] Structured file does not exist: ${structuredPath}`);
    return false;
  }
  if (!existsSync(schemaPath)) {
    console.log(`[FAIL] Schema not found at ${schemaPath}`);
    return false;
  }
  const errors = validateFile(structuredPath, getValidator());
  if (!errors.length) {
    console.log(`[PASS] Schema validation passed: ${structuredPath.split(/[\\/]/).pop()}`);
    return true;
  }
  console.log(`[FAIL] Schema validation failed with ${errors.length} error(s):`);
  for (const err of errors.slice(0, 10)) console.log(`  - ${err}`);
  if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more.`);
  return false;
}

/** Presentation lint of a structured guide. Warnings fail the run; `info` findings do not. */
export function runLint(sec) {
  const { structuredPath } = getSectionPaths(sec);
  if (!existsSync(structuredPath)) {
    console.log(`[SKIP] ${sec.id}: not structured`);
    return true;
  }
  const guide = JSON.parse(readFileSync(structuredPath, "utf8")).guide ?? {};
  const merges = loadMerges(ROOT_DIR);
  const knownIds = new Set(loadCanonicalIndex(ROOT_DIR).sections.map((s) => s.id));
  const navFindings = navigationProblems(guide.navigation, knownIds, merges)
    .map((text) => ({ check: "navigation", severity: "warn", location: "navigation", text }));
  const findings = [...lintGuide(guide), ...navFindings];
  const warns = findings.filter((f) => f.severity === "warn");
  console.log(`\n--- Lint: ${sec.id} --- ${warns.length} warning(s), ${findings.length - warns.length} info`);
  for (const f of findings) {
    const tag = f.severity === "warn" ? "WARN" : "INFO";
    console.log(`  [${tag}] ${f.check.padEnd(14)} ${f.location}: ${f.text}`);
  }
  return warns.length === 0;
}

/** Runs QA verification and records the result in qa-status.json. */
export function runQa(sec) {
  const { canonicalPath, structuredPath } = getSectionPaths(sec);
  console.log(`\n--- QA Verification: ${sec.id} ---`);
  if (!existsSync(canonicalPath)) {
    console.log(`[FAIL] Canonical file does not exist: ${canonicalPath}`);
    return false;
  }
  if (!existsSync(structuredPath)) {
    console.log(`[FAIL] Structured file does not exist: ${structuredPath}`);
    return false;
  }
  const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  const structured = JSON.parse(readFileSync(structuredPath, "utf8"));
  const report = verifyGuide(canonical, structured);
  const qa = report.qa;
  const status = qa.status ?? "FAIL";
  const summary = qa.summary ?? {};

  console.log(`QA Status: [${status}]`);
  console.log(`  Critical: ${summary.critical ?? 0} | High: ${summary.high ?? 0} | ` +
    `Medium: ${summary.medium ?? 0} | Low: ${summary.low ?? 0}`);
  for (const f of qa.findings ?? []) {
    console.log(`  ${f.id} [${String(f.severity ?? "").toUpperCase()}] ${f.location}`);
    console.log(`      ${f.category}: ${f.description}`);
    console.log(`      source: ${short(f.source?.text)} | generated: ${short(f.generated?.text)}`);
  }

  const reportPath = saveQaReport(sec.id, report);
  console.log(`  Full report: ${rel(reportPath)}`);
  recordQaResult(ROOT_DIR, sec.id, structuredPath, status, summary);
  return status.startsWith("PASS");
}

/** Runs the Astro build so rendering/type errors surface per section. */
export function runBuild() {
  console.log("\n--- Frontend Build ---");
  const isWin = process.platform === "win32";
  const result = spawnSync(isWin ? "cmd" : "npm", isWin ? ["/c", "npm", "run", "build"] : ["run", "build"],
    { cwd: ROOT_DIR, encoding: "utf8" });
  if (result.status !== 0) {
    console.log("[FAIL] npm run build failed:");
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/);
    console.log(output.slice(-25).join("\n"));
    return false;
  }
  console.log("[PASS] npm run build succeeded.");
  return true;
}

/** Warns when the stored subagent verdict no longer matches the structured file. */
function staleVerdictNote(sec) {
  const verdictPath = join(ROOT_DIR, "qa-reports", `${sec.id}.subagent.json`);
  const { structuredPath } = getSectionPaths(sec);
  if (!existsSync(verdictPath) || !existsSync(structuredPath)) return null;
  let recorded;
  try {
    recorded = JSON.parse(readFileSync(verdictPath, "utf8")).structured_sha256;
  } catch {
    return null;
  }
  if (!recorded) {
    return `[NOTE] ${sec.id}: stored subagent verdict has no content hash (recorded before hashing); ` +
      "re-record with `verdict` to enable the stale check.";
  }
  if (recorded !== structuredSha(structuredPath)) {
    return `[WARN] ${sec.id}: structured file changed after the subagent verdict; ` +
      "re-run the independent QA subagent and record it with `verdict`.";
  }
  return null;
}

/** Validates the independent QA subagent's JSON verdict and stores it next to the QA report. */
export function runVerdict(sec, verdictFile, readStdin) {
  console.log(`\n--- Subagent QA Verdict: ${sec.id} ---`);
  let verdict;
  try {
    const raw = verdictFile === "-" ? readStdin() : readFileSync(verdictFile, "utf8");
    verdict = JSON.parse(raw.replace(/^﻿/, ""));
  } catch (err) {
    console.log(`[FAIL] Cannot read verdict JSON '${verdictFile}': ${err.message}`);
    return false;
  }
  const errors = validateInstance(verdict, compileSchemaFile(verdictSchemaPath));
  if (errors.length) {
    console.log(`[FAIL] Verdict does not match qa-verdict.schema.json (${errors.length} error(s)):`);
    for (const e of errors.slice(0, 10)) console.log(`  - ${e.path.join("/") || "<root>"}: ${e.message}`);
    return false;
  }
  if (verdict.section_id !== sec.id) {
    console.log(`[FAIL] Verdict is for '${verdict.section_id}', not '${sec.id}'`);
    return false;
  }
  const outDir = join(ROOT_DIR, "qa-reports");
  mkdirSync(outDir, { recursive: true });
  const { structuredPath } = getSectionPaths(sec);
  if (existsSync(structuredPath)) verdict.structured_sha256 = structuredSha(structuredPath); // stale check
  writeFileSync(join(outDir, `${sec.id}.subagent.json`), pyJson(verdict) + "\n", "utf8");
  const findings = verdict.findings ?? [];
  console.log(`Verdict: [${verdict.verdict}] with ${findings.length} finding(s)`);
  for (const f of findings) {
    console.log(`  [${String(f.severity).toUpperCase()}] ${f.category} @ ${f.location}: ${f.issue}`);
  }
  console.log(`  Stored: qa-reports/${sec.id}.subagent.json`);
  const draft = join(outDir, `${sec.id}.subagent-draft.json`);
  if (existsSync(draft)) unlinkSync(draft); // the stored verdict supersedes the subagent's scratch file
  return verdict.verdict !== "FAIL";
}

/** Walkthroughs need an independent QA subagent pass (manual step, see CLAUDE.md section 5). */
function remindIndependentQa(sec) {
  if (!String(sec.id ?? "").startsWith("w-")) return;
  if (existsSync(join(ROOT_DIR, "qa-reports", `${sec.id}.subagent.json`))) {
    const note = staleVerdictNote(sec);
    if (note) console.log(`\n${note}`);
    return; // verdict already stored via `verdict`
  }
  console.log(`\n[REMINDER] Independent QA subagent not run by the pipeline. For ${sec.id}, run ` +
    `node scripts/guide.mjs qa-prompt ${sec.id}, give that prompt to a subagent, then store its ` +
    `verdict with: node scripts/guide.mjs verdict ${sec.id} <file.json>`);
}

/** Prints the exact prompt for the independent QA subagent and the path it should write to. */
/** Prompt lines describing merges that touch this section (empty when none). */
function mergeNotes(sec) {
  const notes = Object.entries(loadMerges(ROOT_DIR))
    .filter(([from, m]) => from === sec.id || m.into === sec.id)
    .map(([from, m]) => `\n  merge map: ${from} is folded into ${m.into} (${m.reason ?? "no reason recorded"}). ` +
      `A navigation link to ${from} is correct when it points to ${m.into}; do not flag it.`);
  return notes.join("");
}

export function printSubagentPrompt(sec) {
  const { canonicalPath, structuredPath } = getSectionPaths(sec);
  if (!existsSync(structuredPath)) {
    console.log(`[FAIL] Structured file does not exist: ${structuredPath}`);
    return false;
  }
  const verdictPath = join(ROOT_DIR, "qa-reports", `${sec.id}.subagent-draft.json`);
  const posix = (p) => relative(ROOT_DIR, p).split(/[\\/]/).join("/");
  console.log(`Use the \`qa\` skill. Independently review section ${sec.id} (${sec.title}).

Compare the canonical source with the structured guide and judge whether the presentation changed
while the source meaning stayed intact (names, numbers, conditions, warnings, choices, bosses,
items, save points, ordering). Do not edit any file except the verdict.
Not a finding: a section's heading location that is absent from \`route\` (side quests).${mergeNotes(sec)}

  canonical:  ${posix(canonicalPath)}
  structured: ${posix(structuredPath)}
  script QA:  qa-reports/${sec.id}.md (for context only; do not trust it)

Return ONLY a JSON verdict that validates against .claude/skills/qa/schemas/qa-verdict.schema.json and write it to
${posix(verdictPath)}.

Do NOT run \`guide.mjs verdict\` yourself: the caller records the verdict after reading it.
(The caller stores it with: node scripts/guide.mjs verdict ${sec.id} ${posix(verdictPath)})`);
  return true;
}

/** Stages exactly this section's files for one commit (never commits). */
export function runFinalize(sec) {
  const { structuredPath } = getSectionPaths(sec);
  const sid = sec.id;
  const verdictFile = join(ROOT_DIR, "qa-reports", `${sid}.subagent.json`);
  const candidates = [structuredPath, join(ROOT_DIR, "qa-status.json"), join(ROOT_DIR, "STATUS.md"),
    join(ROOT_DIR, "qa-reports", `${sid}.md`), join(ROOT_DIR, "qa-reports", `${sid}.json`), verdictFile];
  console.log(`\n--- Finalize: ${sid} ---`);
  if (!existsSync(structuredPath)) {
    console.log(`[FAIL] Structured file does not exist: ${structuredPath}`);
    return false;
  }
  if (sid.startsWith("w-") && !existsSync(verdictFile)) {
    console.log(`[FAIL] Independent QA verdict missing (qa-reports/${sid}.subagent.json); run \`verdict\` first.`);
    return false;
  }
  const qa = auditSection(ROOT_DIR, sec, loadQaStatus(ROOT_DIR)).qa_status;
  if (!String(qa).startsWith("PASS")) {
    console.log(`[FAIL] Script QA is ${qa}; run \`check\` until it passes.`);
    return false;
  }
  const note = staleVerdictNote(sec);
  if (note) console.log(note);
  const paths = candidates.filter(existsSync).map((p) => relative(ROOT_DIR, p).split(/[\\/]/).join("/"));
  const result = spawnSync("git", ["add", "--", ...paths], { cwd: ROOT_DIR, encoding: "utf8" });
  if (result.status !== 0) {
    console.log(`[FAIL] git add failed: ${(result.stderr ?? "").trim()}`);
    return false;
  }
  console.log("Staged:");
  for (const p of paths) console.log(`  ${p}`);
  console.log(`Suggested message: feat(guide): add ${sid} ${sec.title} structured section with QA verdict`);
  return true;
}

export function updateProjectStatus() {
  console.log("\n--- Updating Project Status ---");
  const data = computeProjectStatus(ROOT_DIR);
  writeStatusMarkdown(ROOT_DIR, data);
  console.log(renderCompactSummary(data));
}

/** Prints one section's status line set. */
export function printSectionStatus(sec) {
  const { canonicalPath, structuredPath } = getSectionPaths(sec);
  console.log(`\nSection Status: ${sec.id} - ${sec.title}`);
  console.log(`  Code:       ${sec.code}`);
  console.log(`  Category:   ${sec.category}`);
  console.log(`  Canonical:  ${existsSync(canonicalPath) ? "EXISTS" : "MISSING"} (${canonicalPath.split(/[\\/]/).pop()})`);
  console.log(`  Structured: ${existsSync(structuredPath) ? "EXISTS" : "MISSING"} (${structuredPath.split(/[\\/]/).pop()})`);
  const qa = auditSection(ROOT_DIR, sec, loadQaStatus(ROOT_DIR)).qa_status;
  console.log(`  QA:         ${qa === "NONE" ? "PENDING (none or stale)" : qa}`);
}

/** Runs QA on every structured section with no current QA result. */
export function resolveBacklog() {
  console.log("\n=== Resolving QA Backlog ===");
  const { sections } = getCanonicalManifest();
  let verified = 0;
  for (const sec of sections) {
    const audited = auditSection(ROOT_DIR, sec, loadQaStatus(ROOT_DIR));
    if (audited.structured && audited.qa_status === "NONE") {
      console.log(`\nProcessing backlog for section: ${sec.id} (${sec.title})`);
      if (!runValidate(sec)) console.log(`[WARN] Validation issues in ${sec.id}, proceeding to QA...`);
      if (runQa(sec)) {
        console.log(`[PASS] Successfully verified ${sec.id}.`);
        verified++;
      } else {
        console.log(`[WARN] QA reported issues for ${sec.id}.`);
      }
    }
  }
  if (verified > 0) {
    updateProjectStatus();
    console.log(`\nResolved backlog for ${verified} section(s).`);
  } else {
    console.log("No pending QA backlog items found.");
  }
  return verified;
}

/** Bolds terms in the section's prose so QA always sees the final file (walkthroughs only). */
function runBold(sec) {
  const { structuredPath } = getSectionPaths(sec);
  if (!existsSync(structuredPath) || !String(sec.id).startsWith("w-")) return;
  const found = boldFile(structuredPath, compilePattern(buildDictionary()), true);
  if (found.length) {
    const unique = [...new Set(found)].sort();
    console.log(`[bold] ${sec.id}: bolded ${unique.length} term(s): [${unique.map((t) => `'${t}'`).join(", ")}]`);
  }
}

/** Single per-section gate: bold -> validate -> lint -> QA -> build -> status. */
export function runCheck(sec, build = true) {
  runBold(sec);
  let ok;
  if (!runValidate(sec)) {
    // QA would record a result against an invalid file, and the build is wasted.
    console.log("[SKIP] lint, QA and build skipped: fix schema validation first.");
    ok = false;
  } else {
    ok = runLint(sec) && runQa(sec);
    if (ok && build) ok = runBuild();
  }
  updateProjectStatus(); // always: STATUS.md must reflect a failing QA too
  if (ok) remindIndependentQa(sec);
  return ok;
}
