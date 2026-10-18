// sections.mjs - Section lookup: canonical manifest, identifier resolution, file paths.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT_DIR } from "./status.mjs";
import { PROJECT } from "./project_config.mjs";

const base = (p) => p.split(/[\\/]/).pop();
const stem = (p) => base(p).replace(/\.[^.]*$/, "");

/** Returns { source, sections } from the canonical manifest. */
export function getCanonicalManifest() {
  const manifestPath = join(ROOT_DIR, "canonical-sources", PROJECT.canonicalIndexFile);
  if (!existsSync(manifestPath)) throw new Error(`Canonical manifest not found: ${manifestPath}`);
  const data = JSON.parse(readFileSync(manifestPath, "utf8"));
  return { source: data.source ?? {}, sections: data.sections_index ?? [] };
}

/** Resolves a section by id (w-1-04), code ([W-1-04]), file stem, or filename. Returns null when unknown or ambiguous. */
export function resolveSection(identifier) {
  const { sections } = getCanonicalManifest();
  const cleanId = identifier.trim().toLowerCase();
  const cleanIdNoCode = cleanId.replace(/^[[\]]+|[[\]]+$/g, "");

  const exact = [];
  const partial = [];
  for (const sec of sections) {
    const secId = (sec.id ?? "").toLowerCase();
    const secCode = (sec.code ?? "").toLowerCase().replace(/^[[\]]+|[[\]]+$/g, "");
    const relFile = sec.file ?? "";
    const fileName = base(relFile).toLowerCase();
    const fileStem = stem(relFile).toLowerCase();

    if ([secId, fileStem, fileName].includes(cleanId) || cleanIdNoCode === secCode) {
      exact.push(sec);
    } else if (fileStem.includes(cleanId)) {
      partial.push(sec);
    }
  }

  // An exact match always wins; a partial match is only accepted when it is unique.
  const matches = exact.length ? exact : partial;
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const names = matches.slice(0, 6).map((m) => m.id ?? "?").join(", ");
    const more = matches.length > 6 ? ` (+${matches.length - 6} more)` : "";
    console.log(`[ERROR] '${identifier}' is ambiguous: matches ${names}${more}`);
  }
  return null;
}

/** Returns { canonicalPath, structuredPath } for a manifest section. */
export function getSectionPaths(sec) {
  const relCanonical = sec.file ?? "";
  const filename = relCanonical ? base(relCanonical) : `${sec.id}.json`;
  return {
    canonicalPath: join(ROOT_DIR, "canonical-sources", relCanonical),
    structuredPath: join(ROOT_DIR, "structured-content", "sections", filename),
  };
}
