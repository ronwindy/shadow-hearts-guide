#!/usr/bin/env node
// guide.mjs - Guide conversion CLI: scaffold, validate, lint, QA, patch, bold, status and check.
//
//   node scripts/guide.mjs <command> [options]
//
// Run `node scripts/guide.mjs --help` for the command list.

import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { ROOT_DIR, computeProjectStatus, renderCompactSummary, writeStatusMarkdown, pyJson } from "./status.mjs";
import { resolveSection, getSectionPaths, getCanonicalManifest } from "./sections.mjs";
import { runPatch } from "./patch_section.mjs";
import { mineTerms, loadExtras, buildDictionary, compilePattern, boldFile } from "./bold_terms.mjs";
import { runFrontendAudit } from "./audit_frontend.mjs";
import {
  runScaffold, runValidate, runLint, runQa, runVerdict, printSubagentPrompt, runFinalize,
  runBuild, runCheck, printSectionStatus, resolveBacklog,
} from "./pipeline.mjs";

const HELP = `Guide conversion CLI

Usage: node scripts/guide.mjs <command> [options]

Commands:
  check <id...> [--full] [--no-build]   Per-section gate: bold -> validate -> lint -> QA -> build -> status
                                        (several ids build once at the end; --full adds the frontend audit)
  scaffold <id> [--force]               Generate a structured draft from the canonical source
  validate <id>                         Validate structured JSON against the schema
  lint [<id>]                           Presentation lint (all sections when no id)
  qa <id>                               Run QA verification and record the result in qa-status.json
  qa-prompt <id>                        Print the independent QA subagent prompt and verdict path
  verdict <id> <file|->                 Validate and store the independent QA subagent verdict
  finalize <id>                         Stage exactly this section's files (no commit)
  backlog                               Run QA on every structured section without a current result
  frontend                              Run the frontend / UX audit
  patch <id> [patch.json|-] [--rename OLD=NEW] [--dry-run] [--force]
                                        Merge a JSON patch into a structured section and re-validate
  bold <id> [--write]                   Bold terms in one section (dry run unless --write)
  bold --all [--write]                  Bold terms in every walkthrough section
  bold --terms                          Print the bold-term dictionary by category
  status [--update] [--json]            Project status (--update rewrites STATUS.md)
  status <id>                           Status of one section
  help                                  Show this message
`;

/** Splits argv into positionals and flags. Repeatable flags collect into arrays. */
function parseArgs(argv) {
  const positional = [];
  const flags = { rename: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rename") {
      flags.rename.push(argv[++i] ?? "");
    } else if (a === "--force" || a === "-f") {
      flags.force = true;
    } else if (a.startsWith("--")) {
      flags[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const readStdin = () => readFileSync(0, "utf8");

/** Resolves every identifier to a section, or exits with an error. */
function resolveAll(ids) {
  return ids.map((ident) => {
    const sec = resolveSection(ident);
    if (!sec) {
      console.log(`[ERROR] Could not resolve section for identifier: '${ident}'`);
      process.exit(1);
    }
    return sec;
  });
}

function requireId(positional, command) {
  if (!positional.length) {
    console.log(`[ERROR] '${command}' needs a section id. Run 'node scripts/guide.mjs help'.`);
    process.exit(1);
  }
  return resolveAll([positional[0]])[0];
}

function cmdCheck(positional, flags) {
  if (!positional.length) {
    console.log("[ERROR] 'check' needs at least one section id.");
    process.exit(1);
  }
  const secs = resolveAll(positional);
  const batch = secs.length > 1;
  const build = !(flags.noBuild || batch);
  let ok = secs.map((sec) => runCheck(sec, build)).every(Boolean);
  if (batch && !flags.noBuild) ok = ok && runBuild(); // a build on top of failed sections is wasted
  if (flags.full && ok) ok = runFrontendAudit(); // the audit reads the built HTML, so it runs last
  return ok ? 0 : 1;
}

function cmdLint(positional) {
  if (positional.length) return runLint(resolveAll([positional[0]])[0]) ? 0 : 1;
  const { sections } = getCanonicalManifest();
  const results = sections.map((sec) => runLint(sec));
  return results.every(Boolean) ? 0 : 1;
}

function cmdBold(positional, flags) {
  if (flags.terms) {
    const cats = mineTerms();
    for (const [cat, names] of [...cats].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      console.log(`## ${cat} (${names.size})`);
      console.log([...names].sort().join(", "));
    }
    console.log(`## extras: ${JSON.stringify(loadExtras())}`);
    return 0;
  }
  const pat = compilePattern(buildDictionary());
  const structuredDir = join(ROOT_DIR, "structured-content", "sections");
  let files;
  if (flags.all) {
    files = readdirSync(structuredDir).filter((f) => /^w-.*\.json$/.test(f)).sort().map((f) => join(structuredDir, f));
  } else {
    if (!positional.length) {
      console.log("[ERROR] 'bold' needs a section id, --all or --terms.");
      return 1;
    }
    const sec = resolveAll([positional[0]])[0];
    files = [getSectionPaths(sec).structuredPath];
  }
  for (const path of files) {
    const found = boldFile(path, pat, Boolean(flags.write));
    const name = path.split(/[\\/]/).pop();
    console.log(`${name}: +${found.length} bolded -> [${[...new Set(found)].sort().map((t) => `'${t}'`).join(", ")}]`);
  }
  return 0;
}

function cmdPatch(positional, flags) {
  if (!positional.length) {
    console.log("[ERROR] 'patch' needs a section id.");
    return 1;
  }
  return runPatch({
    section: positional[0],
    patchArg: positional[1],
    renames: flags.rename,
    dryRun: Boolean(flags.dryRun),
    force: Boolean(flags.force),
    readStdin,
  });
}

function cmdStatus(positional, flags) {
  if (positional.length) {
    printSectionStatus(resolveAll([positional[0]])[0]);
    return 0;
  }
  const data = computeProjectStatus(ROOT_DIR);
  if (flags.json) {
    console.log(pyJson(data));
    return 0;
  }
  if (flags.update) {
    const changed = writeStatusMarkdown(ROOT_DIR, data);
    console.log(`${changed ? "Updated" : "Unchanged"} ${join(ROOT_DIR, "STATUS.md")}`);
  }
  console.log(renderCompactSummary(data));
  return 0;
}

/** Runs the chosen command and returns its exit code. */
export function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return command ? 0 : 1;
  }

  switch (command) {
    case "check":
      return cmdCheck(positional, flags);
    case "scaffold": {
      const sec = requireId(positional, command);
      return runScaffold(sec, Boolean(flags.force)) ? 0 : 1;
    }
    case "validate":
      return runValidate(requireId(positional, command)) ? 0 : 1;
    case "lint":
      return cmdLint(positional);
    case "qa":
      return runQa(requireId(positional, command)) ? 0 : 1;
    case "qa-prompt":
      return printSubagentPrompt(requireId(positional, command)) ? 0 : 1;
    case "verdict": {
      const sec = requireId(positional, command);
      if (!positional[1]) {
        console.log("[ERROR] 'verdict' needs a verdict JSON file, or '-' for stdin.");
        return 1;
      }
      return runVerdict(sec, positional[1], readStdin) ? 0 : 1;
    }
    case "finalize":
      return runFinalize(requireId(positional, command)) ? 0 : 1;
    case "backlog":
      resolveBacklog();
      return 0;
    case "frontend":
      return runFrontendAudit() ? 0 : 1;
    case "patch":
      return cmdPatch(positional, flags);
    case "bold":
      return cmdBold(positional, flags);
    case "status":
      return cmdStatus(positional, flags);
    default:
      console.log(`[ERROR] Unknown command '${command}'.\n`);
      console.log(HELP);
      return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
