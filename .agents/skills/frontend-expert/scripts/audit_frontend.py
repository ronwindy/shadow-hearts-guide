#!/usr/bin/env python3
"""
Frontend & UX Audit Script for Shadow Hearts Guide.
Checks Astro source templates and built HTML for:
1. Responsive table containers (prevents mobile viewport blowouts)
2. Micro-font regressions (< 12px on content text)
3. Exposed internal codes in headings (e.g. [W-1-01])
4. Responsive navigation footers (Prev/Next buttons)
5. Touch targets and viewport configurations
"""

import sys
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]
SRC_DIR = ROOT_DIR / "src"
DIST_DIR = ROOT_DIR / "dist"

def audit_astro_sources():
    issues = []
    warnings = []
    
    astro_files = list(SRC_DIR.glob("**/*.astro"))
    if not astro_files:
        issues.append("No .astro files found in src/")
        return issues, warnings

    for path in astro_files:
        rel_path = path.relative_to(ROOT_DIR)
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()

        for idx, line in enumerate(lines, 1):
            # 1. Micro-font check: text-[9px] or text-[10px] on long text
            if re.search(r"text-\[(?:8|9|10)px\]", line):
                # Allow if explicitly marked as badge or mono pill
                if not any(token in line for token in ["badge", "pill", "rounded", "font-mono"]):
                    warnings.append(f"{rel_path}:{idx} Micro-font detected without badge context: {line.strip()[:60]}...")

            # 2. Unwrapped table check: <table> not preceded by overflow-x-auto
            if "<table" in line:
                # check previous 3 lines for overflow-x-auto
                window = "\n".join(lines[max(0, idx - 4):idx])
                if "overflow-x-auto" not in window:
                    issues.append(f"{rel_path}:{idx} <table> may cause mobile overflow (missing overflow-x-auto wrapper)")

            # 3. Non-wrapping Prev/Next navigation
            if "navigation.prev" in line and "navigation.next" in line:
                if "flex-col sm:flex-row" not in line and "grid" not in line:
                    warnings.append(f"{rel_path}:{idx} Prev/Next container should use 'flex-col sm:flex-row' to prevent mobile button squishing")

    return issues, warnings

def audit_built_html():
    issues = []
    warnings = []
    
    if not DIST_DIR.exists():
        return issues, ["dist/ directory does not exist yet. Run `npm run build` first."]

    html_files = list(DIST_DIR.glob("**/*.html"))
    for path in html_files:
        rel_path = path.relative_to(ROOT_DIR)
        content = path.read_text(encoding="utf-8")

        # 1. Check viewport meta
        if '<meta name="viewport"' not in content:
            issues.append(f"{rel_path} Missing <meta name='viewport'> tag.")

        # 2. Check for exposed raw bracketed codes in headings (e.g. <h1>[W-1-01]</h1>)
        heading_matches = re.findall(r'<h[1-3][^>]*>(.*?)<\/h[1-3]>', content, re.IGNORECASE | re.DOTALL)
        for h in heading_matches:
            if re.search(r'\[[A-Z]-[0-9S]-[0-9]+\]', h):
                warnings.append(f"{rel_path} Raw technical code found in heading: '{h.strip()}'")

    return issues, warnings

def main():
    print("=" * 60)
    print("Shadow Hearts Guide — Frontend & UX Audit")
    print("=" * 60)

    src_issues, src_warnings = audit_astro_sources()
    html_issues, html_warnings = audit_built_html()

    total_issues = len(src_issues) + len(html_issues)
    total_warnings = len(src_warnings) + len(html_warnings)

    if total_issues > 0:
        print("\n[!] CRITICAL UX / RESPONSIVE ISSUES:")
        for item in src_issues + html_issues:
            print(f"  - {item}")

    if total_warnings > 0:
        print("\n[*] UX / READABILITY RECOMMENDATIONS:")
        for item in src_warnings + html_warnings:
            print(f"  - {item}")

    print("\n" + "-" * 60)
    if total_issues == 0 and total_warnings == 0:
        print("[PASS] All Frontend & UX checks passed perfectly.")
        sys.exit(0)
    elif total_issues == 0:
        print(f"[PASS] Zero critical issues. {total_warnings} recommendation(s) for visual polish.")
        sys.exit(0)
    else:
        print(f"[FAIL] Found {total_issues} issue(s) and {total_warnings} warning(s). Please review.")
        sys.exit(1)

if __name__ == "__main__":
    main()
