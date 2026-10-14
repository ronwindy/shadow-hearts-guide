// patch_section.mjs - Merge a JSON patch into a structured section file and re-validate.
//
// Patch format: the same shape as the structured file, containing only what changes.
//   - Objects are merged recursively.
//   - `null` deletes the key.
//   - Arrays replace the target array...
//   - ...except when the patch value is an OBJECT and the target is an array of objects that
//     carry an `id` (e.g. guide.steps). Then the object's keys are ids: each value is merged
//     into the element with that id, `null` removes that element, and an unknown id appends
//     a new element (its `id` is filled from the key).
//
//     {"guide": {"steps": {"4": {"type": "shop"}, "5": null},
//                "objectives": ["Defeat Li Li"]}}
//
// Rename an item everywhere (names in items_summary, shops, rewards, boss drops and gear) with
// the reserved top-level key `$rename`, or the `--rename OLD=NEW` flag (repeatable):
//
//     {"$rename": {"TalismanOfLuck": "Talisman of Luck"}}
//
// After the merge, integer step ids with gaps are renumbered 1..N, and `(step N)` cites in
// items_summary locations follow, unless the same patch sets items_summary itself.
//
// The file is written only if the result passes schema validation (override with --force).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ROOT_DIR, pyJson } from "./status.mjs";
import { resolveSection, getSectionPaths } from "./sections.mjs";
import { getValidator, validateInstance } from "../.claude/skills/guide-transformer/scripts/validate_guide.mjs";

const isDict = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isIdList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => isDict(x) && "id" in x);
const RENAME_KEYS = ["name", "matched_overview_item", "drop"];

/** Integer keys become numbers when the list's ids are numbers (JSON object keys are strings). */
const coerceId = (key, sample) => (Number.isInteger(sample) && /^-?\d+$/.test(key) ? Number(key) : key);

/** Renames item-name values in place (recursively); returns the number of replacements. */
export function renameNames(node, mapping) {
  let count = 0;
  if (isDict(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (RENAME_KEYS.includes(key) && typeof value === "string" && mapping.has(value)) {
        node[key] = mapping.get(value);
        count++;
      } else if (key === "equipment" && Array.isArray(value)) {
        value.forEach((entry, i) => {
          if (typeof entry === "string" && mapping.has(entry)) {
            value[i] = mapping.get(entry);
            count++;
          }
        });
      } else {
        count += renameNames(value, mapping);
      }
    }
  } else if (Array.isArray(node)) {
    for (const entry of node) count += renameNames(entry, mapping);
  }
  return count;
}

/** Merges `patch` into a copy of `target` using the rules in the file header. */
export function merge(target, patch) {
  if (isDict(patch) && isIdList(target)) {
    const result = structuredClone(target);
    for (const [key, change] of Object.entries(patch)) {
      const itemId = coerceId(key, result[0].id);
      const idx = result.findIndex((el) => el.id === itemId);
      if (change === null) {
        if (idx >= 0) result.splice(idx, 1);
      } else if (idx < 0) {
        result.push({ id: itemId, ...change });
      } else {
        result[idx] = merge(result[idx], change);
      }
    }
    return result;
  }
  if (isDict(patch) && isDict(target)) {
    const result = structuredClone(target);
    for (const [key, change] of Object.entries(patch)) {
      if (change === null) delete result[key];
      else if (key in result) result[key] = merge(result[key], change);
      else result[key] = change;
    }
    return result;
  }
  return structuredClone(patch);
}

/**
 * Closes gaps in integer step ids (e.g. after a `null` removal) and returns Map(old -> new).
 * Only runs when the ids are strictly increasing in list order; anything else is left alone.
 * "(step N)" cites in items_summary locations follow the new ids when `remapCites` is set.
 */
export function renumberSteps(guide, remapCites) {
  const steps = guide.steps;
  if (!isIdList(steps)) return new Map();
  const ids = steps.map((s) => s.id);
  if (!ids.every((i) => Number.isInteger(i))) return new Map();
  const sorted = ids.every((id, i) => id === i + 1);
  if (sorted || ids.some((b, i) => i > 0 && ids[i - 1] >= b)) return new Map();

  const mapping = new Map(ids.map((old, i) => [old, i + 1]));
  for (const step of steps) step.id = mapping.get(step.id);
  if (remapCites) {
    for (const group of Object.values(guide.items_summary ?? {})) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        const loc = isDict(item) ? item.location : null;
        if (typeof loc === "string") {
          item.location = loc.replace(/(\bsteps?\s+)(\d+)/gi,
            (_, prefix, num) => `${prefix}${mapping.get(Number(num)) ?? Number(num)}`);
        }
      }
    }
  }
  return mapping;
}

/** CLI entry: returns the process exit code. */
export function runPatch({ section, patchArg, renames = [], dryRun = false, force = false, readStdin }) {
  const sec = resolveSection(section);
  if (!sec) {
    console.log(`[ERROR] Could not resolve section: '${section}'`);
    return 1;
  }
  const { structuredPath } = getSectionPaths(sec);
  if (!existsSync(structuredPath)) {
    console.log(`[ERROR] Structured file does not exist: ${structuredPath}`);
    return 1;
  }
  if (!patchArg && !renames.length) {
    console.log("[ERROR] Give a patch file and/or at least one --rename OLD=NEW");
    return 1;
  }

  let patch = {};
  if (patchArg === "-") patch = JSON.parse(readStdin().replace(/^﻿/, ""));
  else if (patchArg) patch = JSON.parse(readFileSync(patchArg, "utf8").replace(/^﻿/, ""));

  const mapping = new Map(Object.entries(patch.$rename ?? {}));
  delete patch.$rename;
  for (const spec of renames) {
    const sep = spec.indexOf("=");
    const old = spec.slice(0, sep);
    const neu = spec.slice(sep + 1);
    if (sep < 0 || !old || !neu) {
      console.log(`[ERROR] --rename expects OLD=NEW, got '${spec}'`);
      return 1;
    }
    mapping.set(old, neu);
  }

  const original = JSON.parse(readFileSync(structuredPath, "utf8"));
  const merged = merge(original, patch);
  if (isDict(merged.guide)) {
    const citesPatched = "items_summary" in (patch.guide ?? {});
    const moved = renumberSteps(merged.guide, !citesPatched);
    if (moved.size) {
      const changes = [...moved].filter(([o, n]) => o !== n).map(([o, n]) => `${o}->${n}`).join(", ");
      console.log(`[INFO] Renumbered step ids to close gaps (${changes})` +
        (citesPatched ? "; items_summary cites left as patched." : "; step cites updated."));
    }
  }
  if (mapping.size) {
    const renamed = renameNames(merged, mapping);
    console.log(`[INFO] Renamed ${renamed} value(s) for ${mapping.size} name(s).`);
  }

  const errors = validateInstance(merged, getValidator());
  if (errors.length) {
    console.log(`[FAIL] Patched result has ${errors.length} schema error(s):`);
    for (const err of errors.slice(0, 15)) {
      console.log(`  - [${err.path.join("/") || "root"}] ${err.message}`);
    }
    if (!force) {
      console.log("Nothing written. Fix the patch (or use --force).");
      return 1;
    }
  } else {
    console.log("[PASS] Patched result passes schema validation.");
  }

  if (dryRun) {
    console.log("Dry run: nothing written.");
    return 0;
  }
  writeFileSync(structuredPath, pyJson(merged) + "\n", "utf8");
  console.log(`Wrote ${structuredPath.slice(ROOT_DIR.length + 1)}`);
  return 0;
}
