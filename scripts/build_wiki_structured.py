"""Build structured-content/game-wiki-overview.json from the Fandom canonical record.

Deterministic mapping only: wording is copied verbatim from
canonical-sources/game-wiki-fandom.canonical.json. Sections flagged
`out_of_home_scope` (Plot, Non Playable Characters) are left out.

Usage: .\\scripts\\run-py.cmd -I scripts/build_wiki_structured.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = os.path.join(ROOT, 'canonical-sources', 'game-wiki-fandom.canonical.json')
OUT = os.path.join(ROOT, 'structured-content', 'game-wiki-overview.json')

# Existing character portraits in public/characters, keyed by the first word of the entry name.
PORTRAITS = {
    'yuri': 'Yuri.webp',
    'alice': 'alice.webp',
    'li': 'Zhuzhen.webp',
    'margarete': 'Margarete.webp',
    'keith': 'Keith.webp',
    'halley': 'Halley.webp',
}


def slug(title):
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')


def flat_index(nodes, acc=None):
    acc = {} if acc is None else acc
    for n in nodes:
        acc[n['title']] = n
        flat_index(n['children'], acc)
    return acc


def main():
    canon = json.load(open(CANON, encoding='utf-8'))
    nodes = flat_index(canon['sections'])
    images = {i['file_key']: i for i in canon['images']}

    def get(title):
        if title not in nodes:
            sys.exit(f'Missing section in canonical record: {title}')
        n = nodes[title]
        if n['out_of_home_scope']:
            sys.exit(f'Section is out of home-page scope: {title}')
        return n

    def img(key):
        i = images[key]
        out = {'file': i['file'], 'alt': i['alt'], 'caption': i['caption']}
        if i.get('width'):
            out['width'] = int(i['width'])
        if i.get('height'):
            out['height'] = int(i['height'])
        return out

    def paragraphs(n):
        return [b['text'] for b in n['blocks'] if b['type'] == 'p']

    def notes(n):
        return [b['text'] for b in n['blocks'] if b['type'] == 'note']

    def first_image(n):
        for b in n['blocks']:
            if b['type'] == 'image':
                return img(b['file_key'])
        return None

    def text_section(title):
        n = get(title)
        sec = {'id': slug(title), 'title': title}
        if notes(n):
            sec['notes'] = notes(n)
        im = first_image(n)
        if im:
            sec['image'] = im
        sec['paragraphs'] = paragraphs(n)
        items = []
        for b in n['blocks']:
            if b['type'] != 'li':
                continue
            m = re.match(r'^(.*?\bRings?)\s+(.*)$', b['text'])
            if m:
                items.append({'lead': m.group(1), 'rest': m.group(2)})
            else:
                items.append({'lead': '', 'rest': b['text']})
        if items:
            sec['items'] = items
        return sec

    # --- intro -------------------------------------------------------
    intro_node = canon['sections'][0]
    assert intro_node['title'] == 'Intro'
    intro = {'notes': notes(intro_node), 'paragraphs': paragraphs(intro_node)}
    im = first_image(intro_node)
    if im:
        intro['image'] = im

    # --- gameplay ----------------------------------------------------
    gameplay_sub = ['Environment/World Map/Submap', 'Battle', 'Judgement Ring',
                    'Special Abilities', 'Malice', 'Shopping']
    gameplay = {
        'paragraphs': paragraphs(get('Gameplay')),
        'sections': [text_section(t) for t in gameplay_sub],
    }

    # --- playable characters -----------------------------------------
    playable = []
    for b in get('Playable Characters')['blocks']:
        if b['type'] != 'li':
            continue
        name = b['text'].split(' (')[0].strip()
        entry = {'name': name, 'text': b['text']}
        file = PORTRAITS.get(name.split(' ')[0].lower())
        if file:
            entry['portrait'] = {'file': f'characters/{file}', 'alt': name, 'caption': name}
        playable.append(entry)

    # --- development -------------------------------------------------
    development = {
        'paragraphs': paragraphs(get('Development')),
        'sections': [text_section('Demo Version'), text_section('Prototype')],
    }

    # --- media & audio -----------------------------------------------
    def voice(title):
        n = get(title)
        credits = []
        for b in n['blocks']:
            if b['type'] != 'li':
                continue
            raw = b['text']
            actor, _, roles = raw.partition('—')
            credits.append({'actor': actor.strip(), 'roles': roles.strip(), 'raw': raw})
        return {'intro': paragraphs(n)[0] if paragraphs(n) else '', 'credits': credits}

    media_audio = {
        'media': text_section('Media'),
        'audio': text_section('Audio'),
        'voice_acting': {'english': voice('English'), 'japanese': voice('Japanese')},
        'soundtrack': text_section('Soundtrack'),
        'production_credits': text_section('Production Credits'),
    }

    # --- reception ---------------------------------------------------
    rec = get('Reception')
    reception = {'paragraphs': paragraphs(rec)}
    for b in rec['blocks']:
        for l in b.get('links', []):
            if l.get('footnote'):
                reception['footnote'] = {'text': l['text'], 'href': l['href']}

    # --- gallery -----------------------------------------------------
    gallery = []
    for title in ('Covers', 'Promotional'):
        n = get(title)
        gallery.append({
            'title': title,
            'images': [img(b['file_key']) for b in n['blocks'] if b['type'] == 'image'],
        })

    # --- external links ----------------------------------------------
    ext = []
    for b in get('External links')['blocks']:
        if b.get('links'):
            # label is the whole list item (it carries text outside the link, e.g. "(Japanese)")
            ext.append({'text': b['text'], 'href': b['links'][0]['href']})

    data = {
        'id': 'game-wiki-overview',
        'title': 'Shadow Hearts — Game Wiki Overview',
        'source': {
            'url': canon['source_url'],
            'file': canon['source_file'],
            'license_note': canon['license_note'],
        },
        'intro': intro,
        'gameplay': gameplay,
        'characters': {'playable': playable},
        'development': development,
        'media_audio': media_audio,
        'reception': reception,
        'gallery': gallery,
        'external_links': ext,
        'flags': canon['quirks'],
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(f'wrote {os.path.relpath(OUT, ROOT)}: {len(playable)} playable, '
          f'{len(gameplay["sections"])} gameplay sections, {len(gallery)} gallery groups')


if __name__ == '__main__':
    main()
