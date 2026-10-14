// validate_guide.mjs - Formal JSON Schema validator for structured game guides.
//
// Validates structured guide JSON files against schemas/structured-guide.schema.json (Ajv, 2020-12).
// Exposes validateFile() for the pipeline; the `validate` subcommand wraps it in the CLI.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));

export const SCHEMA_PATH = resolve(here, "..", "schemas", "structured-guide.schema.json");

let cached = null;

/** Compiles any 2020-12 JSON Schema file into a validator function. */
export function compileSchemaFile(schemaPath) {
  if (!existsSync(schemaPath)) throw new Error(`Schema file not found at: ${schemaPath}`);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

/** Compiled validator for the structured-guide schema (cached per process). */
export function getValidator(schemaPath = SCHEMA_PATH) {
  if (cached && schemaPath === SCHEMA_PATH) return cached;
  const validate = compileSchemaFile(schemaPath);
  if (schemaPath === SCHEMA_PATH) cached = validate;
  return validate;
}

/** Schema errors for an in-memory value: [{ path: string[], message }], sorted by path. */
export function validateInstance(instance, validate = getValidator()) {
  validate(instance);
  const errors = (validate.errors ?? []).map((err) => ({
    path: err.instancePath.split("/").slice(1),
    message: err.message,
  }));
  errors.sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
  return errors;
}

/** Returns error message strings for one JSON guide file (empty when valid). */
export function validateFile(filePath, validate) {
  let instance;
  try {
    instance = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    return [`JSON Parse Error: ${e.message}`];
  }
  return validateInstance(instance, validate).map((err) =>
    `[${err.path.length ? err.path.join("/") : "root"}] ${err.message}`);
}

/** Prints a PASS/FAIL report like the Python CLI did. Returns the number of failed files. */
export function reportFiles(files, schemaPath = SCHEMA_PATH) {
  const validate = getValidator(schemaPath);
  let failed = 0;
  console.log(`Validating ${files.length} file(s) against schema: ${schemaPath.split(/[\\/]/).pop()}\n${"=".repeat(60)}`);
  for (const file of files) {
    const errors = validateFile(file, validate);
    const rel = relative(process.cwd(), file);
    if (!errors.length) {
      console.log(`  [PASS] ${rel}`);
    } else {
      console.log(`  [FAIL] ${rel} (${errors.length} error(s)):`);
      for (const err of errors) console.log(`         - ${err}`);
      failed++;
    }
  }
  console.log("=".repeat(60));
  console.log(`Summary: ${files.length - failed} passed, ${failed} failed out of ${files.length} file(s).`);
  return failed;
}
