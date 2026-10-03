#!/usr/bin/env python3
"""
validate_guide.py - Formal JSON Schema Validator for Structured Game Guides

Validates structured guide JSON files against structured-guide.schema.json using jsonschema.
Supports validating a single file or batch-validating structured-content/sections/.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Tuple, Dict, Any

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ImportError:
    print("Error: 'jsonschema' package not installed. Run: pip install jsonschema")
    sys.exit(1)


def load_schema(schema_path: str) -> Dict[str, Any]:
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_file(file_path: str, validator: Draft202012Validator) -> List[str]:
    """Validates a single JSON guide file. Returns list of error messages (empty if valid)."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            instance = json.load(f)
    except Exception as e:
        return [f"JSON Parse Error: {e}"]

    errors = []
    for err in sorted(validator.iter_errors(instance), key=lambda e: e.path):
        loc = "/".join(str(p) for p in err.path) if err.path else "root"
        errors.append(f"[{loc}] {err.message}")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate structured game guide JSON against schema.")
    parser.add_argument("files", nargs="*", help="Path(s) to JSON guide files to validate")
    parser.add_argument("--schema", "-s", default=None, help="Path to schema JSON file")
    parser.add_argument("--all", "-a", action="store_true", help="Validate all JSON files in structured-content/sections/")

    args = parser.parse_args()

    # Determine default schema path
    script_dir = Path(__file__).resolve().parent
    schema_path = args.schema
    if not schema_path:
        default_schema = script_dir.parent / "schemas" / "structured-guide.schema.json"
        if default_schema.exists():
            schema_path = str(default_schema)
        else:
            workspace_root = script_dir.parents[3]
            schema_path = str(workspace_root / "structured-content" / "schema" / "structured-guide.schema.json")

    if not os.path.exists(schema_path):
        print(f"Error: Schema file not found at: {schema_path}")
        sys.exit(1)

    schema = load_schema(schema_path)
    validator = Draft202012Validator(schema)

    target_files: List[str] = []
    if args.all:
        workspace_root = script_dir.parents[3]
        sections_dir = workspace_root / "structured-content" / "sections"
        if sections_dir.exists():
            target_files.extend(sorted(str(p) for p in sections_dir.glob("*.json")))
        else:
            print(f"Warning: sections directory not found: {sections_dir}")

    for f in args.files:
        if f not in target_files:
            target_files.append(f)

    if not target_files:
        print("No files specified. Use --all or provide path(s) to JSON files.")
        sys.exit(1)

    total_files = len(target_files)
    passed_files = 0
    failed_files = 0

    print(f"Validating {total_files} file(s) against schema: {os.path.basename(schema_path)}\n" + "=" * 60)

    for file_path in target_files:
        errors = validate_file(file_path, validator)
        rel_path = os.path.relpath(file_path)
        if not errors:
            print(f"  [PASS] {rel_path}")
            passed_files += 1
        else:
            print(f"  [FAIL] {rel_path} ({len(errors)} error(s)):")
            for err in errors:
                print(f"         - {err}")
            failed_files += 1

    print("=" * 60)
    print(f"Summary: {passed_files} passed, {failed_files} failed out of {total_files} file(s).")

    if failed_files > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
