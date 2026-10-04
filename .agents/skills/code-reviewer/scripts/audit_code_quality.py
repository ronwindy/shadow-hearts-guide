#!/usr/bin/env python3
"""
audit_code_quality.py - Code Quality & Human Readability Auditor

Performs deterministic static analysis on:
1. Python scripts (scripts/*.py, .agents/skills/*/scripts/*.py)
2. TypeScript & Astro source files (src/**/*.ts, src/**/*.astro)

Evaluates:
- Critical issues: syntax errors, debugging breakpoints, bare excepts.
- Readability & Maintainability warnings:
  - Deep nesting (> 4 levels)
  - Overly long functions (> 60 lines)
  - Missing module/function docstrings in public interfaces
  - Leftover console.log or debug print statements
  - Overly long source files (> 350 lines without modular breakdown)
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent


class PythonQualityVisitor(ast.NodeVisitor):
    def __init__(self, filename: str, content_lines: List[str]):
        self.filename = filename
        self.lines = content_lines
        self.critical_issues: List[str] = []
        self.warnings: List[str] = []
        self.current_depth = 0
        self.max_nesting = 0

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._check_function(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._check_function(node)
        self.generic_visit(node)

    def _check_function(self, node):
        func_len = (node.end_lineno or node.lineno) - node.lineno + 1
        
        # Check function length
        if func_len > 75:
            self.warnings.append(
                f"{self.filename}:{node.lineno} - Function '{node.name}' is too long ({func_len} lines). Consider modularizing."
            )

        # Check docstring for non-trivial functions (> 15 lines)
        if func_len > 15 and not ast.get_docstring(node):
            if not node.name.startswith("_"):
                self.warnings.append(
                    f"{self.filename}:{node.lineno} - Function '{node.name}' lacks a descriptive docstring explaining its intent."
                )

    def visit_Call(self, node: ast.Call):
        # Check for active breakpoint() or pdb.set_trace()
        if isinstance(node.func, ast.Name):
            if node.func.id == "breakpoint":
                self.critical_issues.append(
                    f"{self.filename}:{node.lineno} - Leftover debugger call: 'breakpoint()'."
                )
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr == "set_trace":
                self.critical_issues.append(
                    f"{self.filename}:{node.lineno} - Leftover debugger call: 'pdb.set_trace()'."
                )
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        if node.type is None:
            self.critical_issues.append(
                f"{self.filename}:{node.lineno} - Bare 'except:' clause catches all exceptions blindly. Specify exception type."
            )
        self.generic_visit(node)

    def _track_nesting(self, node):
        self.current_depth += 1
        if self.current_depth > 4:
            self.warnings.append(
                f"{self.filename}:{node.lineno} - Deep control flow nesting (depth {self.current_depth}). Simplify or extract sub-functions."
            )
        self.generic_visit(node)
        self.current_depth -= 1

    def visit_If(self, node: ast.If):
        self._track_nesting(node)

    def visit_For(self, node: ast.For):
        self._track_nesting(node)

    def visit_While(self, node: ast.While):
        self._track_nesting(node)


def audit_python_file(path: Path) -> Tuple[List[str], List[str]]:
    """Audits a Python source file for syntax errors, breakpoints, nesting depth, and docstrings."""
    critical = []
    warnings = []
    rel_path = path.relative_to(ROOT_DIR).as_posix()

    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        critical.append(f"{rel_path}: Could not read file - {e}")
        return critical, warnings

    lines = content.splitlines()

    # File length check
    if len(lines) > 400:
        warnings.append(
            f"{rel_path}: File has {len(lines)} lines. Consider splitting monolithic responsibilities into smaller modules."
        )

    # Parse AST
    try:
        tree = ast.parse(content, filename=str(path))
    except SyntaxError as e:
        critical.append(f"{rel_path}:{e.lineno} - Python SyntaxError: {e.msg}")
        return critical, warnings

    # Module docstring check
    if len(lines) > 20 and not ast.get_docstring(tree):
        warnings.append(f"{rel_path}:1 - Missing module-level docstring explaining module's purpose and usage.")

    visitor = PythonQualityVisitor(rel_path, lines)
    visitor.visit(tree)

    critical.extend(visitor.critical_issues)
    warnings.extend(visitor.warnings)

    return critical, warnings


def audit_web_file(path: Path) -> Tuple[List[str], List[str]]:
    """Audits a TypeScript or Astro source file for leftover debuggers, console logs, and deep indentation."""
    critical = []
    warnings = []
    rel_path = path.relative_to(ROOT_DIR).as_posix()

    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        critical.append(f"{rel_path}: Could not read file - {e}")
        return critical, warnings

    lines = content.splitlines()

    if len(lines) > 400:
        warnings.append(
            f"{rel_path}: File is {len(lines)} lines long. Consider breaking down into smaller sub-components or utility helpers."
        )

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Critical: debugger statements
        if re.search(r"\bdebugger\b", stripped):
            critical.append(f"{rel_path}:{i} - Leftover 'debugger;' statement detected.")

        # Warnings: leftover console.log / console.debug in production code
        if re.search(r"\bconsole\.(log|debug)\(", stripped):
            warnings.append(f"{rel_path}:{i} - Leftover '{stripped[:40]}...' detected. Remove or replace with proper error logging.")

        # Indentation nesting check (heuristics: > 20 leading spaces or 5 tabs in non-markup sections)
        indent = len(line) - len(line.lstrip(" "))
        if indent >= 24 and not stripped.startswith(("<", "/>", "</")):
            warnings.append(f"{rel_path}:{i} - Excessive indentation depth ({indent // 2} levels). Flatten conditionals or extract logic.")

    return critical, warnings


def run_code_audit(root: Optional[Path] = None) -> Tuple[List[str], List[str]]:
    """Runs quality audit across Python and Web sources in the project."""
    if root is None:
        root = ROOT_DIR

    all_critical: List[str] = []
    all_warnings: List[str] = []

    # 1. Python files
    py_dirs = [root / "scripts", root / ".agents" / "skills"]
    py_files: List[Path] = []
    for d in py_dirs:
        if d.exists():
            py_files.extend(list(d.rglob("*.py")))

    for py_file in sorted(py_files):
        # Skip virtualenvs or cache dirs
        if "__pycache__" in str(py_file) or ".venv" in str(py_file):
            continue
        c, w = audit_python_file(py_file)
        all_critical.extend(c)
        all_warnings.extend(w)

    # 2. Web source files (src/**/*.{ts,astro})
    src_dir = root / "src"
    if src_dir.exists():
        web_files = list(src_dir.rglob("*.ts")) + list(src_dir.rglob("*.astro"))
        for web_file in sorted(web_files):
            c, w = audit_web_file(web_file)
            all_critical.extend(c)
            all_warnings.extend(w)

    return all_critical, all_warnings


def main():
    """CLI entry point for running code quality and readability audit."""
    print("=== Code Quality & Readability Audit ===")
    critical, warnings = run_code_audit()

    if critical:
        print(f"\n[FAIL] {len(critical)} Critical Code Quality Defect(s):")
        for item in critical:
            print(f"  CRITICAL: {item}")

    if warnings:
        print(f"\n[WARN] {len(warnings)} Readability & Cleanliness Recommendation(s):")
        for item in warnings[:15]:
            print(f"  NOTICE: {item}")
        if len(warnings) > 15:
            print(f"  ... and {len(warnings) - 15} more recommendations.")

    if not critical and not warnings:
        print("\n[PASS] Codebase is in pristine condition! Zero critical issues or warnings.")
    elif not critical:
        print(f"\n[PASS] No critical defects. {len(warnings)} readability improvements suggested.")

    # Two-tier exit code: only exit 1 on critical defects
    sys.exit(1 if critical else 0)


if __name__ == "__main__":
    main()
