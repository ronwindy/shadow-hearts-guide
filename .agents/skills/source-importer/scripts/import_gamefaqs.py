#!/usr/bin/env python3
"""
import_gamefaqs.py - Reusable GameFAQs Guide Importer & Canonical Splitter

Extracts a raw GameFAQs guide (saved HTML or text) into canonical structured representation:
1. Master canonical JSON and Markdown index.
2. Per-section canonical JSON files in `sections/` for token-efficient downstream processing.
3. Typed sub-block metadata extraction (overview items/equipment/valuables, enemy tables, boss cards, shops).
4. Strict text reconstruction verification ensuring 100% source fidelity.
"""

import os
import re
import html
import json
import argparse
from typing import Dict, List, Any, Optional, Tuple


def slugify(text: str) -> str:
    """Convert a title to a filesystem-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


def extract_header_field(pattern: str, text: str) -> Optional[str]:
    """Helper to extract a metadata field from the top of the guide text."""
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def parse_overview_blocks(text: str) -> List[Dict[str, Any]]:
    """
    Extracts walkthrough overview boxes containing Save Points, Lottery, Items,
    Equipment, Valuables, Souls, Cash, etc.
    """
    pattern = re.compile(
        r'(\n\s*(?:Save Points|Lottery|Items|Equipment|Valuables|Souls|Cash)\s*\|.*?\n_{10,}\|_{10,})',
        re.DOTALL | re.IGNORECASE
    )
    
    overviews = []
    for m in pattern.finditer(text):
        raw_box = m.group(1)
        lines = raw_box.strip().splitlines()
        box_data: Dict[str, List[str]] = {
            "save_points": [],
            "lottery": [],
            "cash": [],
            "items": [],
            "equipment": [],
            "valuables": [],
            "souls": []
        }
        current_cat: Optional[str] = None
        for line in lines:
            if line.strip().startswith('___'):
                continue
            if '|' not in line:
                continue
            left, right = line.split('|', 1)
            left_clean = re.sub(r'[^A-Za-z ]', '', left).strip().lower()
            if left_clean in ["save points", "save point"]:
                current_cat = "save_points"
            elif left_clean == "lottery":
                current_cat = "lottery"
            elif left_clean == "cash":
                current_cat = "cash"
            elif left_clean == "items":
                current_cat = "items"
            elif left_clean == "equipment":
                current_cat = "equipment"
            elif left_clean == "valuables":
                current_cat = "valuables"
            elif left_clean == "souls":
                current_cat = "souls"
            
            if not current_cat:
                continue
                
            # Strip trailing legends like "* = Initial" or "! = Can only have one"
            cleaned_right = re.sub(r'\s{3,}[!*^]\s*=.*$', '', right).strip()
            if not cleaned_right or cleaned_right.startswith(('—', '-')):
                continue
                
            if current_cat == "save_points":
                box_data["save_points"].append(cleaned_right)
            else:
                # Find checkboxes like [_] Item Name, *[_] Item Name, ![_] Item Name, ^[_] Item Name
                items_found = re.findall(r'([*!^]?\[_\]\s*[^_\[\]]+?)(?=\s{2,}[*!^]?\[_\]|$)', cleaned_right)
                if items_found:
                    for item_str in items_found:
                        name = re.sub(r'^[*!^]?\[_\]\s*', '', item_str).strip()
                        if name:
                            box_data[current_cat].append(name)
                else:
                    box_data[current_cat].append(cleaned_right)
                    
        cleaned_box = {k: v for k, v in box_data.items() if v}
        if cleaned_box:
            overviews.append(cleaned_box)
    return overviews


def parse_enemy_tables(text: str) -> List[Dict[str, Any]]:
    """
    Extracts enemy tables into typed lists of enemy objects.
    """
    pattern = re.compile(
        r'\n\s*Enemy[^\n]*\|[^\n]*HP[^\n]*\|[^\n]*Class[^\n]*\|[^\n]*Notes[^\n]*\n[= \-\'\`|]{10,}\n(.*?)\n[_\s]{10,}[|_]{5,}[|_]{5,}[|_]{10,}',
        re.DOTALL | re.IGNORECASE
    )
    
    enemies_list = []
    for m in pattern.finditer(text):
        content = m.group(1)
        lines = content.splitlines()
        current_enemy: Optional[Dict[str, Any]] = None
        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith(('+', '-', '=')):
                continue
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 4:
                enemy_col, hp_col, class_col, notes_col = parts[0], parts[1], parts[2], parts[3]
                
                # Check for continuation lines
                if not enemy_col and not hp_col and not class_col:
                    if current_enemy and notes_col:
                        current_enemy["notes"] = (current_enemy["notes"] + " " + notes_col).strip()
                    continue
                
                num_m = re.search(r'#(\d+)', enemy_col)
                number = f"#{num_m.group(1)}" if num_m else None
                is_boss = '*' in enemy_col
                is_subboss = '~' in enemy_col
                
                name_clean = re.sub(r'#\d+', '', enemy_col)
                name_clean = re.sub(r'[*~+^]?\[_\]\s*', '', name_clean).strip()
                
                hp_val: Any = None
                if hp_col:
                    try:
                        hp_val = int(hp_col.replace(',', ''))
                    except ValueError:
                        hp_val = hp_col
                        
                current_enemy = {
                    "number": number,
                    "name": name_clean,
                    "hp": hp_val,
                    "class": class_col if class_col else None,
                    "is_boss": is_boss,
                    "is_subboss": is_subboss,
                    "notes": notes_col
                }
                enemies_list.append(current_enemy)
    return enemies_list


def parse_boss_cards(text: str) -> List[Dict[str, Any]]:
    """
    Extracts boss cards into structured objects including boss details, recommended party,
    rewards (EXP, Cash), and tactics.
    """
    boss_starts = list(re.finditer(r'/\s*\*\*\*\s*(BOSS|SUB-BOSS)\s*\*\*\*\s*\\', text, re.IGNORECASE))
    bosses = []
    
    for i, m in enumerate(boss_starts):
        btype = m.group(1).upper()
        start = m.start()
        end_search = boss_starts[i+1].start() if i + 1 < len(boss_starts) else min(len(text), start + 4000)
        card_text = text[start:end_search]
        
        # Reward line: \ ... EXP / \ ... Cash /
        exp_m = re.search(r'\\\s*(\d+)\s*EXP\s*/', card_text, re.IGNORECASE)
        cash_m = re.search(r'\\\s*(\d+)\s*Cash\s*/', card_text, re.IGNORECASE)
        exp_val = int(exp_m.group(1)) if exp_m else None
        cash_val = int(cash_m.group(1)) if cash_m else None
        
        # Parse boss enemies at the top of the card
        boss_enemies = []
        enemy_lines = re.findall(
            r'\|\s*([^|\n]+?)\s*\|\s*(\d+)\s*HP\s*\|\s*Class:\s*([^|\n]+?)\s*\|\s*([^|\n]*?)\s*\|',
            card_text
        )
        for be in enemy_lines:
            b_name = be[0].strip()
            b_hp = int(be[1].strip())
            b_class = be[2].strip()
            drop_raw = be[3].strip()
            drop = re.sub(r'^[*!^]?\[_\]\s*', '', drop_raw).strip() if drop_raw else None
            boss_enemies.append({
                "name": b_name,
                "hp": b_hp,
                "class": b_class,
                "drop": drop if drop else None
            })
            
        # Parse recommended party members (e.g. Yuri [07])
        party_members = re.findall(r'([A-Za-z]+)\s*\[(\d+)\]', card_text[:1000])
        party = []
        seen_party = set()
        for p_name, p_lvl in party_members:
            if p_name not in seen_party and p_name not in ["BOSS", "HP"]:
                seen_party.add(p_name)
                party.append({
                    "name": p_name,
                    "level": int(p_lvl)
                })
                
        # Parse strategy text lines
        lines = card_text.splitlines()
        strat_lines = []
        for l in lines:
            if l.startswith('|') and l.endswith('|'):
                inner = l[1:-1]
                if inner.count('|') == 0:
                    inner_str = inner.strip()
                    # Exclude ascii border remnants
                    if inner_str and not set(inner_str).issubset(set(".'\"—-_ ")):
                        strat_lines.append(inner_str)
            elif l.strip().startswith('\\') and ('EXP' in l or 'Cash' in l):
                break
                
        strategy_text = "\n".join(strat_lines).strip()
        primary_name = ", ".join([b['name'] for b in boss_enemies]) if boss_enemies else "Unknown Boss"
        
        bosses.append({
            "type": btype,
            "name": primary_name,
            "enemies": boss_enemies,
            "party": party,
            "exp": exp_val,
            "cash": cash_val,
            "strategy": strategy_text
        })
        
    return bosses


def parse_shops(text: str) -> List[Dict[str, Any]]:
    """
    Extracts merchant and shop tables.
    """
    pattern = re.compile(r'-[$-]-\s*([^-\n]+?)\s*-[$-]-(.*?)(?=\'[—\'-]+|\Z)', re.DOTALL)
    shops = []
    for m in pattern.finditer(text):
        shop_name = m.group(1).strip()
        body = m.group(2)
        items = []
        for line in body.splitlines():
            line_str = line.strip()
            if not line_str or line_str.startswith(('|====', '====', '.—', "'—")):
                continue
            cols = [c.strip() for c in line.split('|') if c.strip()]
            for col in cols:
                item_match = re.match(r'^(.*?)\s*-\s*(\d+)$', col)
                if item_match:
                    items.append({
                        "name": item_match.group(1).strip(),
                        "price": int(item_match.group(2))
                    })
        if items:
            shops.append({
                "name": shop_name,
                "inventory": items
            })
    return shops


def parse_inline_markers(text: str, overview: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Extracts inline markers from walkthrough paragraphs:
    1. Items/Collectibles tagged as [_NAME_] with 1-indexed line numbers, character offsets,
       matched overview items, and surrounding context.
    2. Structured NOTE callout blocks with line numbers, character offsets, and clean body text.
    """
    import bisect

    overview_lookup: Dict[str, Dict[str, str]] = {}
    if overview:
        for cat in ["items", "equipment", "valuables", "souls", "cash", "lottery"]:
            for item_name in overview.get(cat, []):
                norm_key = re.sub(r'[^a-z0-9]', '', item_name.lower())
                if norm_key and norm_key not in overview_lookup:
                    overview_lookup[norm_key] = {"name": item_name, "category": cat}

    # Precompute line offsets for 1-indexed line number lookup
    lines = text.splitlines(keepends=True)
    line_offsets = []
    curr = 0
    for l in lines:
        line_offsets.append(curr)
        curr += len(l)

    def get_line_num(char_idx: int) -> int:
        return bisect.bisect_right(line_offsets, char_idx)

    # 1. Inline item tags: [_NAME_]
    item_pattern = re.compile(r'\[_([^\]\n_]+(?:_[^\]\n_]+)*)_\]')
    inline_items = []

    for m in item_pattern.finditer(text):
        raw_name = m.group(1).strip()
        start, end = m.start(), m.end()
        line_no = get_line_num(start)

        # Surrounding paragraph context snippet
        p_start = max(0, text.rfind("\n\n", 0, start))
        p_end = text.find("\n\n", end)
        if p_end == -1:
            p_end = len(text)
        para_context = " ".join(text[p_start:p_end].split())

        norm_key = re.sub(r'[^a-z0-9]', '', raw_name.lower())
        matched = overview_lookup.get(norm_key)

        inline_items.append({
            "name": raw_name,
            "raw_tag": f"[_{raw_name}_]",
            "matched_overview_item": matched["name"] if matched else None,
            "category": matched["category"] if matched else None,
            "line": line_no,
            "char_offset": [start, end],
            "context": para_context[:250]
        })

    # 2. Structured NOTE callout blocks
    note_pattern = re.compile(
        r'^[ \t]*NOTE[ \t]+([^\n]+)\n[ \t]*[¯\-]+[ \t]*([^\n]*)\n((?:[ \t]{2,}[^\n]*\n*)*)',
        re.MULTILINE
    )
    notes = []

    for m in note_pattern.finditer(text):
        start, end = m.start(), m.end()
        line_no = get_line_num(start)
        first_line = m.group(1).strip()
        second_line = m.group(2).strip()
        rest = m.group(3).strip()

        full_lines = [first_line]
        if second_line:
            full_lines.append(second_line)
        if rest:
            full_lines.extend([l.strip() for l in rest.splitlines() if l.strip()])
        note_body = " ".join(full_lines)

        notes.append({
            "type": "NOTE",
            "line": line_no,
            "char_offset": [start, end],
            "text": note_body
        })

    return {
        "items": inline_items,
        "notes": notes
    }


def get_category(code: str) -> str:
    """Categorize section based on standard guide codes."""
    if code.startswith("[I-"):
        return "Introduction"
    elif code.startswith("[W-1-") or code in ["[W-S-01]", "[W-S-02]", "[W-S-03]"]:
        return "Walkthrough - Asia"
    elif code.startswith("[W-2-") or (code.startswith("[W-S-") and code not in ["[W-S-01]", "[W-S-02]", "[W-S-03]"]):
        return "Walkthrough - Europe"
    elif code.startswith("[A-1-"):
        return "Appendices"
    elif code.startswith("[C-1-"):
        return "Conclusion"
    return "Other"


def import_gamefaqs_guide(
    html_path: str,
    output_dir: str = "canonical-sources",
    split_sections: bool = True,
    extract_subblocks: bool = True,
    generate_markdown: bool = True,
    lightweight_index: bool = True
) -> Dict[str, Any]:
    """
    Main importer pipeline executing extraction, validation, splitting, and writing.
    """
    print(f"Reading source HTML: {html_path}...")
    with open(html_path, "r", encoding="utf-8") as f:
        raw_html = f.read()

    # Extract raw text from pre elements
    faqspans = re.findall(r'<pre id="(faqspan-\d+)">(.*?)</pre>', raw_html, re.DOTALL)
    if faqspans:
        full_text = html.unescape("".join([s[1] for s in faqspans]))
    else:
        # Fallback for plain <pre> tags
        pre_tags = re.findall(r'<pre[^>]*>(.*?)</pre>', raw_html, re.DOTALL)
        if pre_tags:
            full_text = html.unescape("".join(pre_tags))
        else:
            full_text = raw_html

    # Extract HTML metadata
    title_m = re.search(r'<title>(.*?)</title>', raw_html)
    page_title = title_m.group(1).strip() if title_m else ""

    canonical_m = re.search(r'<link rel="canonical" href="(.*?)"', raw_html)
    canonical_url = canonical_m.group(1).strip() if canonical_m else ""

    desc_m = re.search(r'<meta name="description" content="(.*?)"', raw_html)
    meta_description = desc_m.group(1).strip() if desc_m else ""

    # Top-of-guide fields
    top_chunk = full_text[:4000]
    guide_author = extract_header_field(r'Author:\s*([^\n\r]+)', top_chunk) or "A_Backdated_Future"
    contact_email = extract_header_field(r'Contact Email:\s*([^\n\r]+)', top_chunk)
    facebook = extract_header_field(r'Facebook:\s*([^\n\r]+)', top_chunk)
    game_name = extract_header_field(r'Game:\s*([^\n\r]+)', top_chunk) or "Shadow Hearts"
    region = extract_header_field(r'Region:\s*([^\n\r]+)', top_chunk) or "NTSC"
    guide_type = extract_header_field(r'Type:\s*([^\n\r]+)', top_chunk) or "FAQ/Walkthrough"
    platform = extract_header_field(r'Platform:\s*([^\n\r]+)', top_chunk) or "PlayStation 2"
    version = extract_header_field(r'Version:\s*([^\n\r]+)', top_chunk) or "1.05"
    last_updated = extract_header_field(r'Last Updated:\s*([^\n\r]+)', top_chunk) or "02/15/2012"

    metadata = {
        "title": page_title,
        "game": game_name,
        "platform": platform,
        "region": region,
        "type": guide_type,
        "author": guide_author,
        "contact_email": contact_email,
        "facebook": facebook,
        "version": version,
        "last_updated": last_updated,
        "source_url": canonical_url,
        "source_description": meta_description,
        "source_file": html_path.replace("\\", "/"),
        "stats": {
            "total_characters": len(full_text),
            "total_lines": len(full_text.splitlines()),
            "faqspans_count": len(faqspans)
        }
    }

    # Find section markers
    p1 = re.compile(
        r'(\n\s*««\s*Shadow Hearts\s*»»\s*(\[[^\]]+\])\s*\n[^\n]+\n[^\n]+\n\s*\\\\+\s*([^\n\\]+?)\s*\\\\+[^\n]*\n[^\n]*)',
        re.IGNORECASE
    )
    p2 = re.compile(
        r'(\n[^\n]*Shadow Hearts\s*\|\s*([^\n]+)\n\s*(\[[^\]]+\])\s*\|[^\n]*\n[^\n]*\n[^\n]*)',
        re.IGNORECASE
    )

    all_markers = []
    for m in p1.finditer(full_text):
        all_markers.append((m.start(), m.group(2).strip(), m.group(3).strip(), 'major'))
    for m in p2.finditer(full_text):
        all_markers.append((m.start(), m.group(3).strip(), m.group(2).strip(), 'sub'))

    all_markers.sort(key=lambda x: x[0])

    sections = []

    # Section 0: Header
    header_text = full_text[0:all_markers[0][0]]
    sections.append({
        "id": "header",
        "code": "[HEADER]",
        "title": "Title, Metadata & Intro Notes",
        "category": "Header",
        "section_type": "header",
        "is_sidequest": False,
        "char_count": len(header_text),
        "line_count": len(header_text.splitlines()),
        "text": header_text
    })

    for i in range(len(all_markers)):
        start = all_markers[i][0]
        end = all_markers[i+1][0] if i + 1 < len(all_markers) else len(full_text)
        code = all_markers[i][1]
        title = all_markers[i][2]
        mtype = all_markers[i][3]
        sec_text = full_text[start:end]
        sec_id = code.strip("[]").lower()
        
        sections.append({
            "id": sec_id,
            "code": code,
            "title": title,
            "category": get_category(code),
            "section_type": mtype,
            "is_sidequest": "[W-S-" in code,
            "char_count": len(sec_text),
            "line_count": len(sec_text.splitlines()),
            "text": sec_text
        })

    # Strict reconstruction verification
    reconstructed = "".join([s["text"] for s in sections])
    assert reconstructed == full_text, "CRITICAL ERROR: Reconstructed text does not match original full_text!"
    print(f"Reconstruction verification passed: 100% match ({len(full_text):,} characters, {len(sections)} sections).")

    # Extract sub-blocks if requested
    sections_dir = os.path.join(output_dir, "sections")
    if split_sections:
        os.makedirs(sections_dir, exist_ok=True)

    sections_index = []
    
    for i, s in enumerate(sections):
        sec_id = s["id"]
        title_slug = slugify(s["title"])
        filename = f"{sec_id}-{title_slug}.json" if title_slug else f"{sec_id}.json"
        s["file"] = f"sections/{filename}"
        
        # Sub-blocks
        if extract_subblocks:
            overviews = parse_overview_blocks(s["text"])
            s["overview"] = overviews[0] if overviews else {}
            
            # Consolidated items list
            all_items = []
            if s["overview"]:
                for cat in ["items", "equipment", "valuables", "souls"]:
                    all_items.extend(s["overview"].get(cat, []))
            s["items"] = all_items
            
            s["enemies"] = parse_enemy_tables(s["text"])
            bosses = parse_boss_cards(s["text"])
            s["bosses"] = bosses
            s["boss"] = bosses[0] if len(bosses) == 1 else (bosses if bosses else None)
            s["shops"] = parse_shops(s["text"])
            s["markers"] = parse_inline_markers(s["text"], s["overview"])
        else:
            s["overview"] = {}
            s["items"] = []
            s["enemies"] = []
            s["bosses"] = []
            s["boss"] = None
            s["shops"] = []
            s["markers"] = {"items": [], "notes": []}

        # Index entry for lightweight master overview
        index_entry: Dict[str, Any] = {
            "id": s["id"],
            "code": s["code"],
            "title": s["title"],
            "category": s["category"],
            "section_type": s["section_type"],
            "is_sidequest": s["is_sidequest"],
            "file": s["file"],
            "char_count": s["char_count"],
            "line_count": s["line_count"],
        }
        for k, cnt in [
            ("items_count", len(s["items"])),
            ("inline_items_count", len(s["markers"]["items"])),
            ("enemies_count", len(s["enemies"])),
            ("bosses_count", len(s["bosses"])),
            ("notes_count", len(s["markers"]["notes"])),
            ("shops_count", len(s["shops"]))
        ]:
            if cnt > 0:
                index_entry[k] = cnt
        sections_index.append(index_entry)

    # Write per-section files
    if split_sections:
        for i, s in enumerate(sections):
            prev_sec = {
                "id": sections[i-1]["id"],
                "code": sections[i-1]["code"],
                "title": sections[i-1]["title"],
                "file": sections[i-1]["file"]
            } if i > 0 else None
            
            next_sec = {
                "id": sections[i+1]["id"],
                "code": sections[i+1]["code"],
                "title": sections[i+1]["title"],
                "file": sections[i+1]["file"]
            } if i + 1 < len(sections) else None

            sec_output = {
                "id": s["id"],
                "code": s["code"],
                "title": s["title"],
                "category": s["category"],
                "section_type": s["section_type"],
                "is_sidequest": s["is_sidequest"],
                "source": {
                    "game": metadata["game"],
                    "author": metadata["author"],
                    "version": metadata["version"],
                    "source_url": metadata["source_url"],
                    "source_file": metadata["source_file"]
                },
                "navigation": {
                    "prev": prev_sec,
                    "next": next_sec
                },
                "char_count": s["char_count"],
                "line_count": s["line_count"],
                "overview": s["overview"],
                "items": s["items"],
                "enemies": s["enemies"],
                "bosses": s["bosses"],
                "boss": s["boss"],
                "shops": s["shops"],
                "markers": s["markers"],
                "text": s["text"]
            }
            sec_file_path = os.path.join(output_dir, s["file"])
            with open(sec_file_path, "w", encoding="utf-8") as sf:
                json.dump(sec_output, sf, indent=2, ensure_ascii=False)

        print(f"Written {len(sections)} individual section files to: {sections_dir}")

    # Write master canonical JSON
    os.makedirs(output_dir, exist_ok=True)
    canonical_json_path = os.path.join(output_dir, "shadow-hearts-guide.canonical.json")
    is_lightweight = lightweight_index and split_sections
    master_output: Dict[str, Any] = {
        "source": metadata,
        "sections_index": sections_index
    }
    if not is_lightweight:
        master_output["sections"] = sections

    with open(canonical_json_path, "w", encoding="utf-8") as f:
        json.dump(master_output, f, indent=2, ensure_ascii=False)
    index_mode_label = "lightweight (<30 KB)" if is_lightweight else "full embedded"
    print(f"Written master canonical JSON ({index_mode_label}): {canonical_json_path} ({os.path.getsize(canonical_json_path):,} bytes)")

    # Write master canonical Markdown
    if generate_markdown:
        canonical_md_path = os.path.join(output_dir, "shadow-hearts-guide.canonical.md")
        with open(canonical_md_path, "w", encoding="utf-8") as f:
            f.write(f"# Canonical Source: {metadata['title']}\n\n")
            f.write(f"- **Game:** {metadata['game']}\n")
            f.write(f"- **Platform:** {metadata['platform']}\n")
            f.write(f"- **Region:** {metadata['region']}\n")
            f.write(f"- **Author:** {metadata['author']}\n")
            f.write(f"- **Version:** {metadata['version']}\n")
            f.write(f"- **Last Updated:** {metadata['last_updated']}\n")
            f.write(f"- **Source URL:** {metadata['source_url']}\n")
            f.write(f"- **Original Source File:** `{metadata['source_file']}`\n")
            f.write(f"- **Total Sections:** {len(sections)}\n")
            f.write(f"- **Total Lines:** {metadata['stats']['total_lines']:,}\n\n")
            f.write("---\n\n")
            
            f.write("## Section Index\n\n")
            f.write("| Code | Category | Title | File | Items | Inline | Enemies | Bosses | Notes | Shops |\n")
            f.write("| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n")
            for se in sections_index:
                f.write(f"| {se['code']} | {se['category']} | {se['title']} | [`{se['file']}`]({se['file']}) | {se.get('items_count', 0)} | {se.get('inline_items_count', 0)} | {se.get('enemies_count', 0)} | {se.get('bosses_count', 0)} | {se.get('notes_count', 0)} | {se.get('shops_count', 0)} |\n")
            f.write("\n---\n\n")
            
            for s in sections:
                f.write(f"## {s['code']} {s['title']}\n\n")
                f.write(f"- **Category:** {s['category']}\n")
                f.write(f"- **Type:** {s['section_type']}\n")
                f.write(f"- **Section File:** [`{s['file']}`]({s['file']})\n")
                if s["items"]:
                    f.write(f"- **Extracted Items:** {len(s['items'])}\n")
                if s["markers"]["items"]:
                    f.write(f"- **Inline Item Mentions:** {len(s['markers']['items'])}\n")
                if s["enemies"]:
                    f.write(f"- **Extracted Enemies:** {len(s['enemies'])}\n")
                if s["bosses"]:
                    f.write(f"- **Extracted Bosses:** {len(s['bosses'])}\n")
                if s["markers"]["notes"]:
                    f.write(f"- **Structured Notes:** {len(s['markers']['notes'])}\n")
                if s["shops"]:
                    f.write(f"- **Extracted Shops:** {len(s['shops'])}\n")
                f.write("\n```text\n")
                f.write(s["text"].strip("\n"))
                f.write("\n```\n\n")
        print(f"Written master canonical Markdown: {canonical_md_path} ({os.path.getsize(canonical_md_path):,} bytes)")

    return master_output


def main():
    parser = argparse.ArgumentParser(description="Import GameFAQs guide into canonical source and split sections.")
    parser.add_argument(
        "html_file",
        nargs="?",
        default="raw-sources/Shadow Hearts - Guide and Walkthrough - PlayStation 2 - By A_Backdated_Future - GameFAQs.html",
        help="Path to the raw GameFAQs HTML file"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="canonical-sources",
        help="Directory where canonical source artifacts will be written (default: canonical-sources)"
    )
    parser.add_argument(
        "--no-split",
        action="store_true",
        help="Do not split sections into individual JSON files"
    )
    parser.add_argument(
        "--no-subblocks",
        action="store_true",
        help="Do not extract typed sub-block metadata"
    )
    parser.add_argument(
        "--no-markdown",
        action="store_true",
        help="Do not generate the canonical markdown index file"
    )
    parser.add_argument(
        "--full-index",
        action="store_true",
        help="Embed all sections and full raw texts into master canonical JSON (default is lightweight index under 30 KB)"
    )
    parser.add_argument(
        "--lightweight-index",
        action="store_true",
        default=True,
        help="Write lightweight master index with metadata and sections_index only (<30 KB) (default: True)"
    )

    args = parser.parse_args()

    if not os.path.exists(args.html_file):
        print(f"Error: Specified HTML file not found: {args.html_file}")
        exit(1)

    import_gamefaqs_guide(
        html_path=args.html_file,
        output_dir=args.output_dir,
        split_sections=not args.no_split,
        extract_subblocks=not args.no_subblocks,
        generate_markdown=not args.no_markdown,
        lightweight_index=not args.full_index
    )


if __name__ == "__main__":
    main()
