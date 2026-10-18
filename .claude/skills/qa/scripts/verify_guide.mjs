// verify_guide.mjs - Independent QA verification for converted game guides.
//
// Verifies fidelity between Canonical Source JSON and Structured Guide JSON:
// - Overview items & inline item markers preservation
// - Enemy numbers, HP, classes, and boss flags
// - Boss card stats, recommended levels, rewards, and strategies
// - Shop inventory items and prices
// - Canonical notes and warnings
// - Navigation links consistency
// - Step prose against canonical prose (ordered word diff, text_fidelity.mjs)
//
// Produces a structured QA Report conforming to qa/SKILL.md Section 23.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flattenGuide } from "../../guide-transformer/scripts/richtext.mjs";
import { checkTextFidelity } from "./text_fidelity.mjs";
import { loadMerges, expectedNavId } from "./merges.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = resolve(here, "..", "..", "..", "..");

/** Normalizes item/entity names for comparison (strips punctuation and whitespace). */
export function normalizeName(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Python-style truthiness for values read from JSON. */
const truthy = (v) => !(v === undefined || v === null || v === false || v === 0 || v === "" ||
  (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0));

/** Python-style str() for report text. */
const pyStr = (v) => (v === undefined || v === null ? "None" : typeof v === "object" ? JSON.stringify(v) : String(v));

const isDict = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Ordered list of values as a comparable key (Python tuples compared by value). */
const rowKey = (rows) => JSON.stringify(rows);

/** Verifies that a structured guide accurately and faithfully preserves canonical source knowledge. */
export function verifyGuide(canonical, structured, root = ROOT_DIR) {
  const guide = flattenGuide(structured.guide ?? {}); // block-array rich text -> markdown-lite
  const findings = [];

  const addFinding = (severity, category, location, srcText, genText, desc, owner = "Guide Transformer") => {
    findings.push({
      id: `QA-${String(findings.length + 1).padStart(3, "0")}`,
      severity,
      category,
      location,
      source: { text: pyStr(srcText) },
      generated: { text: pyStr(genText) },
      description: desc,
      recommended_owner: owner,
    });
  };

  // 1. Navigation Check. A canonical link to a merged-away section must resolve to its merge target.
  const secId = String(canonical.id ?? guide.id ?? "");
  const merges = loadMerges(root);
  const cNav = canonical.navigation ?? {};
  const gNav = guide.navigation ?? {};
  for (const direction of ["prev", "next"]) {
    const cLink = cNav[direction];
    const gLink = gNav[direction];
    const expected = truthy(cLink) ? expectedNavId(root, merges, secId, cLink, direction) : null;
    if (truthy(cLink) && !truthy(gLink)) {
      if (expected) addFinding("high", "navigation", `navigation.${direction}`, cLink, null, `Missing ${direction} navigation link`);
    } else if (truthy(cLink) && truthy(gLink)) {
      if (gLink.id !== expected) {
        const why = cLink.id === expected ? "" : ` (canonical ${cLink.id} is merged; see structured-content/merges.json)`;
        addFinding("medium", "navigation", `navigation.${direction}.id`, expected, gLink.id,
          `Navigation ${direction} ID mismatch${why}`);
      }
    }
  }

  // 1b. Reference sections carry canonical text verbatim; any drift is a fidelity defect.
  // Applies to scaffolded appendices (a-1-*, except the a-1-00 index) and to any file that
  // carries reference_blocks; hand-structured intro pages (header, TOC) are exempt.
  const isVerbatimReference = (secId.startsWith("a-1-") && secId !== "a-1-00") || truthy(guide.reference_blocks);
  if (guide.type === "reference" && isVerbatimReference) {
    const refText = (guide.reference_blocks ?? []).map((b) => b.text ?? "").join("");
    if (refText !== (canonical.text ?? "")) {
      addFinding("critical", "factual discrepancy", "reference_blocks",
        `${(canonical.text ?? "").length} chars`, `${refText.length} chars`,
        "Reference block text differs from canonical source text");
    }
  }

  // Collect all structured items (items_summary + all step rewards + initial setup)
  const structItems = new Set();
  const summary = guide.items_summary ?? {};
  for (const item of summary.obtainable ?? []) structItems.add(normalizeName(item.name ?? ""));
  for (const item of summary.initial ?? []) structItems.add(normalizeName(item.name ?? ""));

  const initSetup = guide.initial_setup ?? {};
  for (const cat of ["equipment", "valuables", "souls"]) {
    for (const item of initSetup[cat] ?? []) structItems.add(normalizeName(item));
  }

  for (const step of guide.steps ?? []) {
    for (const reward of step.rewards ?? []) {
      structItems.add(normalizeName(reward.name ?? ""));
      if (truthy(reward.matched_overview_item)) structItems.add(normalizeName(reward.matched_overview_item));
    }
  }

  // 2. Overview Items Check
  const cOverview = canonical.overview ?? {};
  for (const catKey of ["items", "equipment", "valuables", "lottery", "souls"]) {
    for (const rawItem of cOverview[catKey] ?? []) {
      const cleanItem = rawItem.replace(/\*/g, "").replace(/\[_\]/g, "").trim();
      if (!cleanItem || cleanItem === "|") continue;
      if (!structItems.has(normalizeName(cleanItem))) {
        addFinding("high", "missing information", `overview.${catKey}`, cleanItem, "Not found in structured guide",
          `Canonical overview item '${cleanItem}' is missing from structured items_summary and step rewards.`);
      }
    }
  }

  // 3. Enemies Check
  const cEnemies = new Map((canonical.enemies ?? []).filter((e) => truthy(e.name)).map((e) => [e.name, e]));
  const gEnemies = new Map((guide.enemies ?? []).filter((e) => truthy(e.name)).map((e) => [e.name, e]));

  for (const [name, cE] of cEnemies) {
    if (!gEnemies.has(name)) {
      addFinding("high", "missing information", "enemies",
        `${name} (HP: ${pyStr(cE.hp)}, Class: ${pyStr(cE.class)})`, "Missing",
        `Enemy '${name}' is missing from structured enemies list.`);
      continue;
    }
    const gE = gEnemies.get(name);
    if (cE.hp !== gE.hp) {
      addFinding("high", "numerical discrepancy", `enemies[${name}].hp`, cE.hp, gE.hp, `HP mismatch for enemy '${name}'`);
    }
    if (cE.class !== gE.class) {
      addFinding("medium", "factual discrepancy", `enemies[${name}].class`, cE.class, gE.class,
        `Class mismatch for enemy '${name}'`);
    }
    if (truthy(cE.is_boss) !== truthy(gE.is_boss)) {
      addFinding("medium", "factual discrepancy", `enemies[${name}].is_boss`, cE.is_boss, gE.is_boss,
        `is_boss flag mismatch for enemy '${name}'`);
    }
  }

  // 4. Bosses Check (section-level bosses[] plus step-level boss objects)
  const cBosses = canonical.bosses ?? [];
  const gBosses = [...(guide.bosses ?? [])];
  const stepBosses = (guide.steps ?? []).filter((s) => isDict(s.boss)).map((s) => s.boss);
  const gAllBosses = [...gBosses, ...stepBosses];
  const cNames = new Set(cBosses.map((b) => normalizeName(b.name)));
  for (const b of gBosses) {
    if (!cNames.has(normalizeName(b.name))) {
      addFinding("high", "factual discrepancy", `bosses[${pyStr(b.name)}]`, "Not in canonical bosses", b.name,
        "bosses[] contains a boss absent from the canonical source");
    }
  }
  const bossesNames = new Set(gBosses.map((b) => normalizeName(b.name)));
  for (const b of stepBosses) {
    const n = normalizeName(b.name);
    if (!cNames.has(n) && !bossesNames.has(n)) {
      addFinding("low", "structural fidelity", `steps.boss[${pyStr(b.name)}]`, "Not in canonical bosses", b.name,
        "Step-level boss/sub-boss is not in the canonical bosses list; confirm it comes from source text");
    }
  }
  // Same-name fights exist (Li Li as SUB-BOSS, then as BOSS): match on (type, name) first.
  const gByName = new Map(gAllBosses.map((b) => [normalizeName(b.name), b]));
  const gByTypeName = new Map(gAllBosses.map((b) => [`${pyStr(b.type).toUpperCase()}\u0001${normalizeName(b.name)}`, b]));
  const cmpVal = (v, key) => {
    // equipment/fusions lists and drops: spaces/case ignored (the scaffold un-camel-cases "TalismanOfLuck")
    if (Array.isArray(v)) return v.map((x) => pyStr(x).replace(/ /g, "").toLowerCase());
    if (key === "drop" && typeof v === "string") return v.replace(/ /g, "").toLowerCase();
    return v ?? null;
  };
  const plainStrategy = (text) => (text ?? "").replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "").replace(/\*\*/g, "")
    .split(/\s+/).filter(Boolean).join(" ");

  for (const cB of cBosses) {
    const loc = `bosses[${pyStr(cB.name)}]`;
    const gB = gByTypeName.get(`${pyStr(cB.type).toUpperCase()}\u0001${normalizeName(cB.name)}`) ??
      gByName.get(normalizeName(cB.name));
    if (gB === undefined) {
      addFinding("high", "factual discrepancy", loc, cB.name, "Missing", "Boss name not found in structured output");
      continue;
    }
    for (const fld of ["type", "exp", "cash"]) {
      if ((cB[fld] ?? null) !== (gB[fld] ?? null)) {
        addFinding("high", "numerical discrepancy", `${loc}.${fld}`, cB[fld], gB[fld],
          `Boss ${fld} mismatch for ${pyStr(cB.name)}`);
      }
    }
    for (const [fld, keys] of [["party", ["name", "level", "equipment", "fusions"]],
                                ["enemies", ["name", "hp", "class", "drop"]]]) {
      const cRows = (cB[fld] ?? []).map((r) => keys.map((k) => cmpVal(r[k], k)));
      const gRows = (gB[fld] ?? []).map((r) => keys.map((k) => cmpVal(r[k], k)));
      if (rowKey(cRows) !== rowKey(gRows)) {
        addFinding("high", "missing information", `${loc}.${fld}`, rowKey(cRows), rowKey(gRows),
          `Boss ${fld} (${keys.join("/")}) differs from canonical for ${pyStr(cB.name)}`);
      }
    }
    // Presentation (list bullets, **bold**) is not a text change: compare plain words only.
    const cStrat = plainStrategy(cB.strategy);
    const gStrat = plainStrategy(gB.strategy);
    if (cStrat && !gStrat) {
      addFinding("medium", "missing information", `${loc}.strategy`, "Strategy present", "Empty strategy",
        "Missing boss battle strategy");
    } else if (cStrat !== gStrat && gStrat) {
      addFinding("low", "text drift", `${loc}.strategy`, cStrat.slice(0, 80), gStrat.slice(0, 80),
        "Boss strategy text differs from canonical (reworded or edited); review for meaning");
    }
  }

  // 4b. Boss Step Mapping & Redundancy Check (Chronological Flow & Spoiler Prevention)
  const allSteps = guide.steps ?? [];
  const stepEncounterNames = new Set();
  const stepBossNames = new Set();
  for (const s of allSteps) {
    for (const en of s.encounter?.enemies ?? []) stepEncounterNames.add(normalizeName(en));
    if (s.boss?.name) {
      stepBossNames.add(normalizeName(s.boss.name));
      for (const en of s.boss.enemies ?? []) stepBossNames.add(normalizeName(en.name ?? ""));
    }
  }

  for (const b of gAllBosses) {
    const bNorm = normalizeName(b.name ?? "");
    if (!stepEncounterNames.has(bNorm) && !stepBossNames.has(bNorm)) {
      addFinding("medium", "structural fidelity", `bosses[${pyStr(b.name)}]`, b.name, "Not mapped to any walkthrough step",
        `Boss '${pyStr(b.name)}' is defined in bosses overview but is not mapped to any walkthrough step.`);
    }

    // Check for verbatim duplicate strategy in step notes
    const bStrat = (b.strategy ?? "").trim();
    if (!bStrat || bStrat.length <= 30) continue;

    for (const s of allSteps) {
      const dupes = (s.notes ?? []).filter((n) => (n.text ?? "").trim() &&
        ((n.text ?? "").includes(bStrat) || bStrat.includes(n.text)));
      if (dupes.length) {
        addFinding("medium", "redundancy / duplication", `steps[${s.id}].notes`, "Duplicate strategy text",
          "Strategy present in both boss card and step note",
          `Step ${s.id} note duplicates the boss battle strategy for '${pyStr(b.name)}'. Strategy should be in a single location.`);
      }
    }
  }

  // 4c. Choice fidelity: options must appear in the source and outcomes must be traceable to it
  const cText = (canonical.text ?? "").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
  const stop = new Set(["that", "this", "with", "from", "will", "have", "your", "into", "then", "when"]);
  for (const s of guide.steps ?? []) {
    for (const ch of s.choices ?? []) {
      const opt = (ch.option ?? "").replace(/^\s*(\[\d+\]|\d+[.)])\s*/, "").trim().toLowerCase();
      if (opt && !cText.includes(opt)) {
        addFinding("medium", "fidelity", `steps[${s.id}].choices`, ch.option, "Not in source text",
          "Choice option text not found verbatim in canonical text");
      }
      const outcome = (ch.outcome ?? "").trim();
      if (outcome) {
        const words = (outcome.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !stop.has(w));
        const missing = words.filter((w) => !cText.includes(w));
        if (words.length && missing.length / words.length > 0.4) {
          addFinding("medium", "unsupported claim", `steps[${s.id}].choices`, outcome,
            `words not in source: [${missing.map((w) => `'${w}'`).join(", ")}]`,
            "Choice outcome is not traceable to source text (inferred?); omit it unless the source states it");
        }
      }
    }
  }

  // 5. Shops Check
  const cShops = canonical.shops ?? [];
  const gShops = guide.shops ?? [];
  if (cShops.length !== gShops.length) {
    addFinding("high", "missing information", "shops", `${cShops.length} shops in canonical`,
      `${gShops.length} shops in structured`, "Shop count mismatch");
  } else {
    cShops.forEach((cS, idx) => {
      const gS = gShops[idx];
      // Compare names ignoring spacing/case (source CamelCase vs. natural-language spacing)
      const cInv = new Map((cS.inventory ?? []).map((i) => [i.name, i.price]));
      const gInvRaw = new Map((gS.inventory ?? []).map((i) => [normalizeName(i.name), i.price]));
      for (const [iname, iprice] of cInv) {
        if (!gInvRaw.has(normalizeName(iname))) {
          addFinding("high", "missing information", `shops[${pyStr(cS.name)}].inventory`, iname, "Missing",
            `Shop item '${iname}' missing from structured inventory`);
        } else if (gInvRaw.get(normalizeName(iname)) !== iprice) {
          addFinding("high", "numerical discrepancy", `shops[${pyStr(cS.name)}].inventory[${iname}].price`, iprice,
            gInvRaw.get(normalizeName(iname)), `Price mismatch for shop item '${iname}'`);
        }
      }
    });
  }

  // 6. Canonical Notes Check
  const cNotes = canonical.markers?.notes ?? [];
  // Collect all notes in steps and callouts
  const allStructNotes = [];
  for (const step of guide.steps ?? []) allStructNotes.push(...(step.notes ?? []));
  allStructNotes.push(...(guide.callouts ?? []));
  const initNote = guide.initial_setup?.note ?? "";
  const allNotesText = ([...allStructNotes.map((n) => n.text ?? "")].join(" ") + " " + initNote).toLowerCase();

  cNotes.forEach((mn, idx) => {
    // Extract a few key words from canonical note (distinctive: length > 5)
    const noteBody = (mn.text ?? "").toLowerCase();
    const words = (noteBody.match(/[a-z]{5,}/g) ?? [])
      .filter((w) => !["equipped", "default", "battle", "before", "continue"].includes(w));
    const sample = words.slice(0, 3);
    if (sample.length && !sample.some((w) => allNotesText.includes(w))) {
      addFinding("medium", "missing information", `markers.notes[${idx}]`, `${(mn.text ?? "").slice(0, 80)}...`,
        "Not identified in structured notes",
        `Canonical note starting with '${(mn.text ?? "").slice(0, 40)}' may be missing from structured notes.`);
    }
  });

  // 7. Overview save points are carried through (`guide.save_points`, or an intro's overview)
  const cSave = (canonical.overview?.save_points ?? []).map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9]/.test(s) && s.toLowerCase() !== "have one");
  const gSave = [...(guide.save_points ?? []), ...(guide.overview?.save_points ?? [])].join(" ").toLowerCase();
  for (const sp of cSave) {
    if (!normalizeName(gSave).includes(normalizeName(sp))) {
      addFinding("medium", "missing information", "save_points", sp, "Missing",
        `Canonical overview save point '${sp}' is not in guide.save_points`);
    }
  }

  // 8. Objectives must be traceable to the source: most distinctive words occur in the canonical text
  const cAll = (canonical.text ?? "").toLowerCase();
  const bossNames = new Set((canonical.bosses ?? []).map((b) => normalizeName(b.name)));
  (guide.objectives ?? []).forEach((obj, idx) => {
    const plain = String(obj).replace(/\*\*|`/g, "");
    if (bossNames.has(normalizeName(plain.trim().replace(/^defeat\s+/i, "")))) return;
    const generic = new Set(["which", "their", "other", "there", "proceed", "defeat", "collect", "complete", "continue", "reach"]);
    const words = (plain.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !generic.has(w));
    const missing = words.filter((w) => !cAll.includes(w));
    if (words.length && missing.length / words.length > 0.5) {
      addFinding("low", "unsupported claim", `objectives[${idx}]`, obj,
        `words not in source: [${missing.map((w) => `'${w}'`).join(", ")}]`,
        "Objective wording is not traceable to the source text; omit it unless the source states a goal");
    }
  });

  // 9. Every canonical dialogue option appears in choices[] (scaffold groups them per prompt)
  const cOptionCount = [...(canonical.text ?? "").matchAll(/^\s*\S*?>?\s*\[(\d+)\]\s+(\S.*?)(?:\s+<\S*)?\s*$/gm)].length;
  const gOptions = (guide.steps ?? []).flatMap((s) => s.choices ?? []);
  if (cOptionCount && gOptions.length < cOptionCount) {
    addFinding("medium", "missing information", "steps[].choices", `${cOptionCount} options in source`,
      `${gOptions.length} in structured`, "Some dialogue choice options of the source are missing");
  }

  // 10. Reward names match a source token (normalization such as "TeaOfTheHealer" -> "Tea of the Healer" is allowed)
  const tokens = new Set([...(canonical.text ?? "").matchAll(/\[_([^\]]+?)_\]/g)].map((m) => normalizeName(m[1])));
  for (const cat of ["items", "equipment", "valuables", "lottery", "souls"]) {
    for (const i of canonical.overview?.[cat] ?? []) tokens.add(normalizeName(String(i).replace(/[*]|\[_\]/g, "")));
  }
  if (tokens.size) {
    for (const s of guide.steps ?? []) {
      for (const r of s.rewards ?? []) {
        const name = r.matched_overview_item || r.name;
        if (typeof name === "string" && !tokens.has(normalizeName(name))) {
          addFinding("low", "fidelity", `steps[${s.id}].rewards`, name, "No matching source token",
            `Reward '${name}' does not match any item tag or overview item of the source (spelling?)`);
        }
      }
    }
  }

  // 11. Step prose follows the canonical prose (ordered word diff; field checks above miss text).
  // Sections merged into this one (e.g. a hub's transition sentence moved to step 1) count as source.
  const mergedTexts = [];
  for (const [mid, entry] of Object.entries(merges)) {
    if (entry.into === secId) {
      const dir = join(root, "canonical-sources", "sections");
      const files = existsSync(dir)
        ? readdirSync(dir).filter((f) => f.startsWith(`${mid}-`) && f.endsWith(".json")).sort()
        : [];
      for (const f of files) {
        mergedTexts.push(JSON.parse(readFileSync(join(dir, f), "utf8")).text ?? "");
      }
    }
  }
  const severity = { "altered-high": "high" };
  for (const f of checkTextFidelity(canonical, guide, mergedTexts)) {
    addFinding(severity[f.kind] ?? "medium", `text fidelity (${f.kind.replace("-high", "")})`,
      f.location, f.source, f.generated, f.description);
  }

  const summaryCounts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  let status;
  if (summaryCounts.critical > 0 || summaryCounts.high > 0) status = "FAIL";
  else if (summaryCounts.medium > 0 || summaryCounts.low > 0) status = "PASS WITH WARNINGS";
  else status = "PASS";

  return {
    qa: {
      status,
      section_id: guide.id,
      section_title: guide.title,
      summary: summaryCounts,
      findings,
    },
  };
}

/** Formats a QA verification result as GitHub-flavored Markdown. */
export function formatMarkdownReport(report) {
  const qa = report.qa;
  const statusIcon = qa.status === "PASS" ? "[PASS]" : (qa.status === "PASS WITH WARNINGS" ? "[PASS WITH WARNINGS]" : "[FAIL]");
  const lines = [
    `# QA Verification Report: ${qa.section_id ?? "Unknown"} - ${qa.section_title ?? ""}`,
    `\n**Status:** ${statusIcon}\n`,
    "## Summary",
    `- **Critical:** ${qa.summary.critical}`,
    `- **High:** ${qa.summary.high}`,
    `- **Medium:** ${qa.summary.medium}`,
    `- **Low:** ${qa.summary.low}\n`,
  ];

  if (qa.findings.length) {
    lines.push("## Findings\n");
    lines.push("| ID | Severity | Category | Location | Description | Owner |");
    lines.push("|:---|:---|:---|:---|:---|:---|");
    for (const f of qa.findings) {
      lines.push(`| ${f.id} | **${f.severity.toUpperCase()}** | ${f.category} | \`${f.location}\` | ${f.description} | ${f.recommended_owner} |`);
    }
    lines.push("\n### Detailed Discrepancies\n");
    for (const f of qa.findings) {
      lines.push(`#### ${f.id} [${f.severity.toUpperCase()}] - ${f.category}`);
      lines.push(`- **Location:** \`${f.location}\``);
      lines.push(`- **Source:** \`${f.source.text}\``);
      lines.push(`- **Generated:** \`${f.generated.text}\``);
      lines.push(`- **Description:** ${f.description}`);
      lines.push(`- **Recommended Owner:** \`${f.recommended_owner}\`\n`);
    }
  } else {
    lines.push("**No discrepancies found! 100% source fidelity verified.**");
  }
  return lines.join("\n");
}
