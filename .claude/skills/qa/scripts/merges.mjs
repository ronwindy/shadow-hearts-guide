// merges.mjs - Canonical sections folded into another page.
//
// The decision lives in structured-content/merges.json (committed, reviewed by a person), not in
// the generated qa-status.json. Status, QA, the subagent prompt and lint all read it from here.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MERGES_FILE = join("structured-content", "merges.json");

/** Returns { [mergedId]: { into, reason } }. A missing file means nothing is merged. */
export function loadMerges(root) {
  const path = join(root, MERGES_FILE);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")).merges ?? {};
}

/** Canonical navigation block of a section id (empty when its canonical file is missing). */
function loadCanonicalNav(root, id) {
  const dir = join(root, "canonical-sources", "sections");
  const file = existsSync(dir)
    ? readdirSync(dir).find((f) => f.startsWith(`${id}-`) && f.endsWith(".json"))
    : undefined;
  if (!file) return {};
  return JSON.parse(readFileSync(join(dir, file), "utf8")).navigation ?? {};
}

/**
 * The page id a canonical prev/next link must resolve to on section `secId`.
 * A link to a merged-away section lands on its target. If that target is this page, the merged hub
 * is skipped and its own neighbour in the same direction is used (e.g. Prague (1)'s prev is
 * Shanghai, Kuihai Tower, not the merged "Walkthrough - Europe" hub).
 * A merged-away section with no neighbour in this direction (e.g. the header, which has no prev)
 * resolves to no link, even when its content was merged into a page on the other side.
 */
export function expectedNavId(root, merges, secId, link, direction) {
  let id = link.id;
  for (let hops = 0; merges[id] && hops < 10; hops++) {
    const next = loadCanonicalNav(root, id)[direction];
    if (!next?.id) return null;
    if (merges[id].into !== secId) return merges[id].into;
    id = next.id;
  }
  return id;
}

/** Problems in a structured guide's prev/next links: links to merged-away ids and to unknown ids. */
export function navigationProblems(nav = {}, knownIds, merges) {
  const problems = [];
  for (const dir of ["prev", "next"]) {
    const id = nav[dir]?.id;
    if (!id) continue;
    if (merges[id]) {
      problems.push(`${dir} links to ${id}, which is merged into ${merges[id].into}; link to ${merges[id].into}`);
    } else if (!knownIds.has(id)) {
      problems.push(`${dir} links to ${id}, which is not in the canonical index`);
    }
  }
  return problems;
}
