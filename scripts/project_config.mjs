// project_config.mjs - Loads project.config.json (the only place game-specific names live).
// Node-only; Astro files import the JSON directly.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const PROJECT = JSON.parse(readFileSync(join(root, "project.config.json"), "utf8"));
