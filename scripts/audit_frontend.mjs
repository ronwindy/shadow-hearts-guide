// audit_frontend.mjs - Frontend & UX audit for the Astro sources and the built HTML.
//
// Checks: table wrappers (mobile overflow), micro-fonts, exposed internal codes in headings,
// Prev/Next footer layout, invalid fractional Tailwind spacing, viewport meta, ghost utility classes.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT_DIR } from "./status.mjs";

const SRC_DIR = join(ROOT_DIR, "src");
const DIST_DIR = join(ROOT_DIR, "dist");

const ALLOWED_DECIMAL_STEPS = new Set(["0.5", "1.5", "2.5", "3.5"]);
const SPACING_PREFIX = "(?:[a-z0-9\\-]+:)?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)";
const LAYOUT_TOKEN = /^(?:[a-z0-9\-]+:)?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-[a-zA-Z0-9.\-/[\]]+$/;

/** Every file under dir whose name ends with the suffix, recursively. */
function walk(dir, suffix) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, suffix));
    else if (name.endsWith(suffix)) out.push(full);
  }
  return out;
}

const rel = (p) => relative(ROOT_DIR, p);

/** Audits Astro source templates in src/. Returns { issues, warnings }. */
export function auditAstroSources() {
  const issues = [];
  const warnings = [];
  const astroFiles = walk(SRC_DIR, ".astro");
  if (!astroFiles.length) {
    issues.push("No .astro files found in src/");
    return { issues, warnings };
  }
  for (const path of astroFiles) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => auditAstroLine(line, i + 1, lines, rel(path), issues, warnings));
  }
  return { issues, warnings };
}

function auditAstroLine(line, idx, lines, relPath, issues, warnings) {
  // 1. Micro-font check: text-[9px] or text-[10px] on long text
  if (/text-\[(?:8|9|10)px\]/.test(line) && !["badge", "pill", "rounded", "font-mono"].some((t) => line.includes(t))) {
    warnings.push(`${relPath}:${idx} Micro-font detected without badge context: ${line.trim().slice(0, 60)}...`);
  }

  // 2. Unwrapped table check: <table> not preceded by overflow-x-auto
  if (line.includes("<table")) {
    const windowText = lines.slice(Math.max(0, idx - 4), idx).join("\n");
    if (!windowText.includes("overflow-x-auto")) {
      issues.push(`${relPath}:${idx} <table> may cause mobile overflow (missing overflow-x-auto wrapper)`);
    }
  }

  // 3. Non-wrapping Prev/Next navigation
  if (line.includes("navigation.prev") && line.includes("navigation.next")) {
    if (!line.includes("flex-col sm:flex-row") && !line.includes("grid")) {
      warnings.push(`${relPath}:${idx} Prev/Next container should use 'flex-col sm:flex-row'`);
    }
  }

  // 4. Invalid Tailwind fractional spacing steps
  for (const m of line.matchAll(new RegExp(`\\b(${SPACING_PREFIX})-(\\d+\\.\\d+)\\b`, "g"))) {
    if (!ALLOWED_DECIMAL_STEPS.has(m[2])) {
      issues.push(`${relPath}:${idx} Invalid / non-standard Tailwind spacing '${m[0]}'. ` +
        "Use standard integer steps (e.g. p-4) or explicit arbitrary pixels [18px].");
    }
  }
}

/** Audits compiled production HTML in dist/ for viewport meta, raw codes in headings and ghost classes. */
export function auditBuiltHtml() {
  const issues = [];
  const warnings = [];
  if (!existsSync(DIST_DIR)) {
    warnings.push("dist/ directory does not exist yet. Run `npm run build` first.");
    return { issues, warnings };
  }

  // Load compiled CSS stylesheet for ghost class detection
  const cssFiles = walk(join(DIST_DIR, "_astro"), ".css");
  const compiledCss = cssFiles.map((f) => readFileSync(f, "utf8")).join("");
  const ghostReported = new Set();

  for (const path of walk(DIST_DIR, ".html")) {
    const relPath = rel(path);
    const content = readFileSync(path, "utf8");

    // 1. Check viewport meta
    if (!content.includes('<meta name="viewport"')) {
      issues.push(`${relPath} Missing <meta name='viewport'> tag.`);
    }

    // 2. Check for exposed raw bracketed codes in headings (e.g. <h1>[W-1-01]</h1>)
    for (const m of content.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
      if (/\[[A-Z]-[0-9S]-[0-9]+\]/.test(m[1])) {
        warnings.push(`${relPath} Raw technical code found in heading: '${m[1].trim()}'`);
      }
    }

    // 3. Ghost Utility Class Detection
    if (compiledCss) checkGhostClasses(content, compiledCss, relPath, ghostReported, issues);
  }
  return { issues, warnings };
}

function checkGhostClasses(content, compiledCss, relPath, reported, issues) {
  for (const m of content.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1].split(/\s+/).filter(Boolean)) {
      if (!LAYOUT_TOKEN.test(token) || reported.has(token)) continue;
      const escaped = token.replace(/:/g, "\\:").replace(/\./g, "\\.").replace(/\//g, "\\/")
        .replace(/\[/g, "\\[").replace(/]/g, "\\]");
      if (!compiledCss.includes(escaped)) {
        reported.add(token);
        issues.push(`${relPath} Ghost CSS utility class detected: '${token}' is present in HTML ` +
          "but has NO CSS rule in compiled stylesheet! (Causes 0 padding / missing styling)");
      }
    }
  }
}

/** Runs the audit, prints the report, and returns true when there are no critical issues. */
export function runFrontendAudit() {
  console.log("\n--- Frontend & UX Audit ---");
  const src = auditAstroSources();
  const html = auditBuiltHtml();
  const issues = [...src.issues, ...html.issues];
  const warnings = [...src.warnings, ...html.warnings];

  if (issues.length) {
    console.log("[FAIL] Critical frontend issues detected:");
    for (const item of issues) console.log(`  - ${item}`);
    return false;
  }
  if (warnings.length) {
    console.log(`[PASS] 0 critical issues. ${warnings.length} recommendation(s):`);
    for (const item of warnings.slice(0, 5)) console.log(`  - ${item}`);
  } else {
    console.log("[PASS] All Frontend & UX checks passed cleanly.");
  }
  return true;
}
