"""Fidelity check for the home page: canonical wiki text -> structured JSON -> dist/index.html.

Checks:
  1. every in-scope canonical text block appears verbatim in the built home page
  2. nothing out of scope (Plot, Non Playable Characters) leaked into the page
  3. facts dropped with the old Wikipedia-based data are gone

Run after `npm run build`.
Usage: .\\scripts\\run-py.cmd -I scripts/check_wiki_fidelity.py
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = os.path.join(ROOT, 'canonical-sources', 'game-wiki-fandom.canonical.json')
PAGE = os.path.join(ROOT, 'dist', 'index.html')
DROPPED_FACTS = ['Machida', 'Metacritic', 'H.P. Lovecraft', 'Devilman', 'Jun Mihara', 'Izumi Hamamoto', 'Miyako Kato']


def norm(text):
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def page_text(raw):
    raw = re.sub(r'<(script|style)[\s\S]*?</\1>', ' ', raw)
    return norm(re.sub(r'<[^>]+>', ' ', raw))


def blocks(nodes, scope_out=None):
    for n in nodes:
        out = n['out_of_home_scope']
        for b in n['blocks']:
            if 'text' in b:
                yield out, n['title'], b
        yield from blocks(n['children'])


def main():
    if not os.path.exists(PAGE):
        sys.exit('dist/index.html missing - run npm run build first')
    canon = json.load(open(CANON, encoding='utf-8'))
    text = page_text(open(PAGE, encoding='utf-8').read())

    failures = []
    checked = 0
    voice_sections = {'English', 'Japanese'}
    for out, title, b in blocks(canon['sections']):
        t = norm(b['text'])
        if out:
            # leak check: use a distinctive 50-char probe from the block
            probe = t[:50]
            if probe and probe in text:
                failures.append(f'LEAK [{title}] {probe!r}')
            continue
        checked += 1
        if title in voice_sections and b['type'] == 'li':
            actor, _, roles = t.partition('—')
            parts = [actor.strip()] + ([roles.strip()] if roles.strip() else [])
            missing = [p for p in parts if p not in text]
            if missing:
                failures.append(f'MISSING [{title}] {missing}')
            continue
        if t not in text:
            failures.append(f'MISSING [{title}] {t[:80]!r}')

    for fact in DROPPED_FACTS:
        if fact in text:
            failures.append(f'DROPPED FACT PRESENT: {fact}')

    print(f'checked {checked} in-scope blocks against dist/index.html')
    if failures:
        print(f'{len(failures)} problem(s):')
        for f in failures:
            print('  -', f)
        sys.exit(1)
    print('OK: all in-scope text present, no out-of-scope leaks, dropped facts absent')


if __name__ == '__main__':
    main()
