"""Extract the saved Shadow Hearts Fandom wiki article into a canonical JSON record.

Source:  raw-sources/*Fandom*.html (snapshot written by the URL-first fetch step,
         see .claude/skills/source-importer/SKILL.md "Source intake")
Output:  canonical-sources/game-wiki-fandom.canonical.json
         public/wiki/<image files> (article-body images only)

Text is kept verbatim (whitespace-normalised); nothing is reworded. Fandom chrome
(ads, navigation, sign-in, edit links, navbox, footer) is dropped.

Usage: .\\scripts\\run-py.cmd -I scripts/extract_fandom_wiki.py
"""
import base64
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_GLOB = os.path.join(ROOT, 'raw-sources', '*Fandom*.html')
OUT_JSON = os.path.join(ROOT, 'canonical-sources', 'game-wiki-fandom.canonical.json')
OUT_IMG_DIR = os.path.join(ROOT, 'public', 'wiki')

SKIP_TAGS = {'noscript', 'script', 'style', 'svg', 'fandom-ad', 'fandom-video-ad', 'input', 'label', 'button'}
MIME_EXT = {'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'}

# Top-level / sub sections that exist in the source but are not shown on the home page.
OUT_OF_HOME_SCOPE = {'Plot', 'Non Playable Characters'}

# Source irregularities to preserve and flag (id, regex, note).
QUIRK_PATTERNS = [
    ('deuhai-typo', r'Deuhai', 'Source spells the antagonist "Deuhai" once; "Dehuai" elsewhere. Preserved.'),
    ('zhuzhen-name', r'Liu Zhuzhen|Zhuzhen Liu', 'Source alternates "Li Zhuzhen" / "Liu Zhuzhen" / "Zhuzhen Liu". Preserved.'),
    ('empty-voice-actor', r'^Eric Stuart\s*[—-]\s*$', 'English voice cast lists "Eric Stuart —" with no role. Preserved.'),
    ('roger-stub', r'Roger:', 'Stray "Roger:" label inside the Roger Bacon paragraph. Preserved.'),
    ('viewedhere', r'viewedhere', 'Source text has "viewedhere" (missing space before link). Preserved.'),
    ('missing-space', r'[a-z]\.When he is not using', 'Source text has a missing space after a full stop ("fusions.When"). Preserved.'),
    ('footnote-removed', None, 'Footnote marker "[1]" (link to MobyGames) was removed from the Reception text; its link is kept in links[].'),
]


def clean(text):
    return re.sub(r'\s+', ' ', text.replace('\xa0', ' ')).strip()


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sections = []          # flat list of {level, title, blocks}
        self.images = []            # all article-body images
        self.stack = []             # (tag, skip?) for every open element
        self.skip_depth = 0
        self.in_heading = None      # 'h2' | 'h3' | 'h4'
        self.in_headline = False
        self.heading_buf = ''
        self.block = None           # current text block {kind, buf, links}
        self.cur_anchor = None
        self.fig_img = None         # image awaiting a caption
        self.list_stack = []
        self.footnote_removed = False

    # --- helpers -------------------------------------------------------
    def _current_section(self):
        if not self.sections:
            self.sections.append({'level': 0, 'title': 'Intro', 'blocks': []})
        return self.sections[-1]

    def _open_block(self, kind):
        if self.block is None:
            self.block = {'kind': kind, 'buf': '', 'links': []}

    def _close_block(self):
        if self.block is None:
            return
        text = clean(self.block['buf'])
        if text:
            entry = {'type': self.block['kind'], 'text': text}
            if self.block['links']:
                entry['links'] = self.block['links']
            self._current_section()['blocks'].append(entry)
        self.block = None

    @staticmethod
    def _is_skipped(tag, attrs):
        a = dict(attrs)
        cls = a.get('class') or ''
        ident = a.get('id') or ''
        if tag in SKIP_TAGS:
            return True
        if 'sf-hidden' in cls:
            return True
        if tag == 'div' and (ident == 'toc' or 'toc' in cls.split() or 'incontent_leaderboard' in cls
                             or ident.startswith('google_ads') or ident == 'incontent_player_container'
                             or 'page-footer' in cls or 'gallery-icon-container' in cls
                             or 'icon-container' in cls):
            return True
        if tag == 'table' and 'navbox' in cls:
            return True
        if tag == 'span' and 'mw-editsection' in cls:
            return True
        if tag == 'div' and ident.startswith('gallery-icon'):
            return True
        # the oversized overlay div Fandom adds on every image
        if tag == 'div' and 'position:absolute' in (a.get('style') or ''):
            return True
        return False

    # --- parser callbacks ---------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        void = tag in ('br', 'img', 'hr', 'input', 'meta', 'link')
        skipped = self._is_skipped(tag, attrs)
        if not void:
            self.stack.append((tag, skipped))
            if skipped:
                self.skip_depth += 1
        if self.skip_depth:
            return

        cls = a.get('class') or ''
        if tag in ('h2', 'h3', 'h4'):
            self._close_block()
            self.in_heading = tag
            self.heading_buf = ''
        elif tag == 'span' and self.in_heading and 'mw-headline' in cls:
            self.in_headline = True
        elif tag == 'p':
            if 'caption' in cls and self.fig_img is not None:
                self.block = {'kind': 'caption', 'buf': '', 'links': []}
            else:
                self._open_block('p')
        elif tag == 'li':
            self._close_block()
            self._open_block('li')
        elif tag == 'dd':
            self._close_block()
            self._open_block('note')
        elif tag == 'div' and 'notice' in cls.split() and 'spoiler' in cls:
            self._close_block()
            self._open_block('notice')
        elif tag == 'br':
            if self.block is not None and self.block['kind'] in ('p', 'li', 'note', 'notice'):
                # <br> starts a new paragraph so line breaks in the source stay visible
                kind = self.block['kind']
                self._close_block()
                self._open_block(kind)
        elif tag == 'figure':
            self.fig_img = None
        elif tag == 'img':
            self._handle_img(a)
        elif tag == 'a':
            self.cur_anchor = {'text': '', 'href': a.get('href', '')}

    def _handle_img(self, a):
        key = a.get('data-image-key') or a.get('data-image-name')
        if not key:
            return  # not an article image (Fandom chrome)
        src = a.get('src') or ''
        img = {
            'file_key': key,
            'file_name': a.get('data-image-name') or key,
            'alt': a.get('alt', ''),
            'caption': a.get('data-caption') or a.get('alt', ''),
            'width': a.get('width'),
            'height': a.get('height'),
            'wiki_src': a.get('data-src', ''),
            'section': None,
            '_data': src if src.startswith('data:') else None,
        }
        sec = self._current_section()
        img['section'] = sec['title']
        sec['blocks'].append({'type': 'image', 'file_key': key})
        self.images.append(img)
        self.fig_img = img

    def handle_endtag(self, tag):
        if tag in ('br', 'img', 'hr', 'input', 'meta', 'link'):
            return
        # pop to the matching open element
        while self.stack:
            t, skipped = self.stack.pop()
            if skipped:
                self.skip_depth -= 1
            if t == tag:
                break
        if self.skip_depth:
            return

        if tag in ('h2', 'h3', 'h4') and self.in_heading == tag:
            title = clean(self.heading_buf)
            self.in_heading = None
            self.in_headline = False
            if title:
                self.sections.append({'level': int(tag[1]), 'title': title, 'blocks': []})
        elif tag == 'span' and self.in_headline:
            self.in_headline = False
        elif tag == 'a' and self.cur_anchor is not None:
            anchor, self.cur_anchor = self.cur_anchor, None
            text = clean(anchor['text'])
            if re.fullmatch(r'\[\d+\]', text):
                self.footnote_removed = True
                if self.block is not None:
                    self.block['links'].append({'text': text, 'href': anchor['href'], 'footnote': True})
            elif text and self.block is not None:
                self.block['links'].append({'text': text, 'href': anchor['href']})
        elif tag in ('p', 'li', 'dd'):
            if self.block is not None and self.block['kind'] == 'caption':
                if self.fig_img is not None:
                    self.fig_img['caption'] = clean(self.block['buf']) or self.fig_img['caption']
                self.block = None
            else:
                self._close_block()
        elif tag in ('ul', 'dl', 'div', 'figure'):
            self._close_block()
            if tag == 'figure':
                self.fig_img = None

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.in_heading:
            if self.in_headline:
                self.heading_buf += data
            return
        if self.cur_anchor is not None:
            self.cur_anchor['text'] += data
        if self.block is not None:
            # footnote marker text is dropped from the verbatim text
            if self.cur_anchor is not None and re.fullmatch(r'\s*\[\d+\]\s*', self.cur_anchor['text']):
                return
            self.block['buf'] += data


def build_tree(flat):
    """Nest the flat section list into h2 -> h3 -> h4 using levels."""
    root = {'level': 1, 'title': '__root__', 'blocks': [], 'children': []}
    stack = [root]
    for s in flat:
        node = {'level': s['level'], 'title': s['title'], 'blocks': s['blocks'], 'children': []}
        lvl = s['level'] or 2
        while len(stack) > 1 and stack[-1]['level'] >= lvl:
            stack.pop()
        stack[-1]['children'].append(node)
        stack.append(node)
    return root['children']


def annotate_scope(nodes, parent_out=False):
    for n in nodes:
        out = parent_out or n['title'] in OUT_OF_HOME_SCOPE
        n['out_of_home_scope'] = out
        annotate_scope(n['children'], out)


def main():
    files = glob.glob(RAW_GLOB)
    if not files:
        sys.exit('No Fandom wiki HTML found in raw-sources/')
    raw_path = files[0]
    html = open(raw_path, encoding='utf-8').read()

    start = html.find('id=mw-content-text')
    end = html.find('Community content is available', start)
    if start < 0 or end < 0:
        sys.exit('Could not locate article body (mw-content-text)')
    body = html[start:end]
    # the stylesheet-style noise inside the body is skipped by the parser; drop <style> blocks early
    body = re.sub(r'<style[\s\S]*?</style>', '', body)

    ex = Extractor()
    ex.feed(body)
    ex._close_block()

    # drop the "Contents" TOC heading if it slipped through as a section
    flat = [s for s in ex.sections if s['title'] != 'Contents']
    tree = build_tree(flat)
    annotate_scope(tree)

    # images: write article-body images to public/wiki
    os.makedirs(OUT_IMG_DIR, exist_ok=True)
    seen = {}
    images = []
    for img in ex.images:
        if img['file_key'] in seen:
            continue
        data = img.pop('_data')
        entry = dict(img)
        entry['file'] = None
        if data:
            m = re.match(r'data:([a-z/+\-]+);base64,(.+)', data, re.S)
            if m and m.group(1) in MIME_EXT:
                ext = MIME_EXT[m.group(1)]
                stem = re.sub(r'[^A-Za-z0-9_\-]+', '-', os.path.splitext(img['file_name'])[0]).strip('-').lower()
                fname = f'{stem}.{ext}'
                blob = base64.b64decode(m.group(2))
                with open(os.path.join(OUT_IMG_DIR, fname), 'wb') as fh:
                    fh.write(blob)
                entry['file'] = f'wiki/{fname}'
                entry['bytes'] = len(blob)
                entry['mime'] = m.group(1)
        seen[img['file_key']] = entry
        images.append(entry)

    # quirks: only those actually found in the extracted text
    all_text = []

    def collect(nodes):
        for n in nodes:
            for b in n['blocks']:
                if 'text' in b:
                    all_text.append(b['text'])
            collect(n['children'])
    collect(tree)
    quirks = []
    for qid, pattern, note in QUIRK_PATTERNS:
        if qid == 'footnote-removed':
            if ex.footnote_removed:
                quirks.append({'id': qid, 'note': note})
        elif any(re.search(pattern, t) for t in all_text):
            quirks.append({'id': qid, 'note': note})

    out = {
        'id': 'game-wiki-fandom',
        'title': 'Shadow Hearts | Shadowhearts Wiki | Fandom',
        'source_file': os.path.relpath(raw_path, ROOT).replace('\\', '/'),
        'source_url': 'https://shadowhearts.fandom.com/wiki/Shadow_Hearts',
        'saved_date': '2026-10-09',
        'license_note': 'Community content is available under CC-BY-SA unless otherwise noted.',
        'sections': tree,
        'images': images,
        'quirks': quirks,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write('\n')

    def count(nodes):
        return sum(1 + count(n['children']) for n in nodes)
    print(f'sections: {count(tree)}  images: {len(images)}  quirks: {len(quirks)}')
    print(f'wrote {os.path.relpath(OUT_JSON, ROOT)}')


if __name__ == '__main__':
    main()
