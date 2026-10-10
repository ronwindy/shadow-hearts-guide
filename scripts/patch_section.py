#!/usr/bin/env python3
"""
patch_section.py - Merge a JSON patch into a structured section file and re-validate.

Replaces ad-hoc edit scripts (and their shell-quoting problems): write the patch with the
Write tool, then run:

    scripts/run-py.cmd scripts/patch_section.py <section_id> <patch.json> [--dry-run] [--force]

Patch format: the same shape as the structured file, containing only what changes.
    - Objects are merged recursively.
    - `null` deletes the key.
    - Arrays replace the target array...
    - ...except when the patch value is an OBJECT and the target is an array of objects that
      carry an `id` (e.g. guide.steps). Then the object's keys are ids: each value is merged
      into the element with that id, `null` removes that element, and an unknown id appends
      a new element (its `id` is filled from the key).

    {"guide": {"steps": {"4": {"type": "shop"}, "5": null},
               "objectives": ["Defeat Li Li"]}}

The file is written only if the result passes schema validation (override with --force).
"""

import sys
import json
import argparse
from copy import deepcopy
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402  (also wires up the skill script import paths)
from jsonschema import Draft202012Validator  # noqa: E402
from validate_guide import load_schema  # noqa: E402


def _is_id_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(v, dict) and "id" in v for v in value)


def _coerce_id(key: str, sample: Any) -> Any:
    return int(key) if isinstance(sample, int) and key.lstrip("-").isdigit() else key


def merge(target: Any, patch: Any) -> Any:
    if isinstance(patch, dict) and _is_id_list(target):
        result = deepcopy(target)
        for key, change in patch.items():
            item_id = _coerce_id(key, result[0]["id"])
            idx = next((i for i, el in enumerate(result) if el["id"] == item_id), None)
            if change is None:
                if idx is not None:
                    result.pop(idx)
            elif idx is None:
                result.append({"id": item_id, **change})
            else:
                result[idx] = merge(result[idx], change)
        return result
    if isinstance(patch, dict) and isinstance(target, dict):
        result = deepcopy(target)
        for key, change in patch.items():
            if change is None:
                result.pop(key, None)
            elif key in result:
                result[key] = merge(result[key], change)
            else:
                result[key] = change
        return result
    return deepcopy(patch)


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge a JSON patch into a structured section and re-validate.")
    parser.add_argument("section", help="Section id, code or file stem (e.g. w-1-06)")
    parser.add_argument("patch", help="Path to the patch JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Validate the merged result without writing")
    parser.add_argument("--force", action="store_true", help="Write even if schema validation fails")
    args = parser.parse_args()

    sec = pipeline.resolve_section(args.section)
    if not sec:
        print(f"[ERROR] Could not resolve section: '{args.section}'")
        return 1
    _, structured_path = pipeline.get_section_paths(sec)
    if not structured_path.exists():
        print(f"[ERROR] Structured file does not exist: {structured_path}")
        return 1

    patch = json.loads(Path(args.patch).read_text(encoding="utf-8"))
    original = json.loads(structured_path.read_text(encoding="utf-8"))
    merged = merge(original, patch)

    schema_path = pipeline.ROOT_DIR / ".claude" / "skills" / "guide-transformer" / "schemas" / "structured-guide.schema.json"
    validator = Draft202012Validator(load_schema(str(schema_path)))
    errors = sorted(validator.iter_errors(merged), key=lambda e: list(e.path))

    if errors:
        print(f"[FAIL] Patched result has {len(errors)} schema error(s):")
        for err in errors[:15]:
            loc = "/".join(str(p) for p in err.path) or "root"
            print(f"  - [{loc}] {err.message}")
        if not args.force:
            print("Nothing written. Fix the patch (or use --force).")
            return 1
    else:
        print("[PASS] Patched result passes schema validation.")

    if args.dry_run:
        print("Dry run: nothing written.")
        return 0

    structured_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {structured_path.relative_to(pipeline.ROOT_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
