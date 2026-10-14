/**
 * markup.ts - Safe Markdown and game controller formatting utility for guide text
 * 
 * Converts standard Markdown emphasis (**bold**, *italic*, `code`), list items,
 * and PlayStation controller button prompts (CROSS -> ✕, CIRCLE -> ◯, etc.) into
 * richly styled HTML elements while preserving text safety and gothic aesthetics.
 */

// Reusable badge templates
const BADGES = {
  cross: '<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-sky-500/80 text-sky-400 shadow-inner align-baseline" title="CROSS button" aria-label="CROSS button">✕</kbd>',
  circle: '<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-rose-500/80 text-rose-400 shadow-inner align-baseline" title="CIRCLE button" aria-label="CIRCLE button">◯</kbd>',
  triangle: '<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-emerald-500/80 text-emerald-400 shadow-inner align-baseline" title="TRIANGLE button" aria-label="TRIANGLE button">△</kbd>',
  square: '<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-fuchsia-500/80 text-fuchsia-400 shadow-inner align-baseline" title="SQUARE button" aria-label="SQUARE button">□</kbd>',
  shoulder: (label: string, title?: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-gold-500/60 text-gold-300 shadow-inner align-baseline" title="${title || `${label} trigger`}" aria-label="${label}">${label}</kbd>`,
  dpad: (arrow: string, label: string) =>
    `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-600/80 text-amber-300 shadow-inner align-baseline" title="D-Pad ${label}" aria-label="D-Pad ${label}">${arrow}</kbd>`,
  analog: (label: string, title: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-cyan-500/60 text-cyan-300 shadow-inner align-baseline" title="${title}" aria-label="${title}">${label}</kbd>`,
  system: (label: string, title: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-700/80 text-slate-300 shadow-inner align-baseline" title="${title}" aria-label="${title}">${label}</kbd>`,
};

/**
 * Maps PlayStation button tokens and abbreviations to stylized badge HTML representations.
 * Uses a single-pass master regex matcher with token replacement to prevent nested collision.
 */
export function formatControllerButtons(text: string): string {
  if (!text) return '';

  // 1. Standalone cell/string shortcuts (UP, DN, LT, RT, LA, RA, AG, SELECT, START)
  const trimmed = text.trim();
  switch (trimmed) {
    case 'UP': return BADGES.dpad('▲', 'Up');
    case 'DN': return BADGES.dpad('▼', 'Down');
    case 'LT': return BADGES.dpad('◀', 'Left');
    case 'RT': return BADGES.dpad('▶', 'Right');
    case 'LA': return BADGES.analog('L-Stick', 'Left Analog stick');
    case 'RA': return BADGES.analog('R-Stick', 'Right Analog stick');
    case 'AG': return BADGES.system('ANALOG', 'Toggle Analog mode');
    case 'SELECT': return BADGES.system('SELECT', 'Select button');
    case 'START': return BADGES.system('START', 'Start button');
  }

  // 2. Tokenized replacement collector
  const tokens: string[] = [];
  const pushToken = (html: string) => {
    const idx = tokens.length;
    tokens.push(html);
    return `__CTRL_TOK_${idx}__`;
  };

  let res = text;

  // Composite table prompts (e.g. "/\\ (TRIANGLE)", "[] (SQUARE)", ">< (CROSS)", "() (CIRCLE)")
  res = res.replace(/(?:&gt;&lt;|><)\s*\(\s*CROSS\s*\)/gi, () => pushToken(BADGES.cross));
  res = res.replace(/(?:\/\\|\/\\\\)\s*\(\s*TRIANGLE\s*\)/gi, () => pushToken(BADGES.triangle));
  res = res.replace(/\[\]\s*\(\s*SQUARE\s*\)/gi, () => pushToken(BADGES.square));
  res = res.replace(/\(\)\s*\(\s*CIRCLE\s*\)/gi, () => pushToken(BADGES.circle));

  // Analog & stick press composites
  res = res.replace(/\bLA\s*\(\s*LEFT\s+ANALOG\s*\)/gi, () => pushToken(BADGES.analog('L-Stick', 'Left Analog stick')));
  res = res.replace(/\bRA\s*\(\s*RIGHT\s+ANALOG\s*\)/gi, () => pushToken(BADGES.analog('R-Stick', 'Right Analog stick')));
  res = res.replace(/\bL3\s*\(\s*Press\s*\)/gi, () => pushToken(BADGES.shoulder('L3', 'L3 Stick button')));
  res = res.replace(/\bR3\s*\(\s*Press\s*\)/gi, () => pushToken(BADGES.shoulder('R3', 'R3 Stick button')));

  // System button composites
  res = res.replace(/\bSL\s*\(\s*SELECT\s*\)/gi, () => pushToken(BADGES.system('SELECT', 'Select button')));
  res = res.replace(/\bST\s*\(\s*START\s*\)/gi, () => pushToken(BADGES.system('START', 'Start button')));

  // D-Pad inside text phrases: "D-Pad UP", "DPAD DN", etc.
  res = res.replace(/\b(?:D-Pad|DPAD)\s+UP\b/gi, () => `D-Pad ${pushToken(BADGES.dpad('▲', 'Up'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+DN\b/gi, () => `D-Pad ${pushToken(BADGES.dpad('▼', 'Down'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+LT\b/gi, () => `D-Pad ${pushToken(BADGES.dpad('◀', 'Left'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+RT\b/gi, () => `D-Pad ${pushToken(BADGES.dpad('▶', 'Right'))}`);

  // Action verbs preceding buttons: "press CROSS", "taps SQUARE", etc.
  const actionVerbs = '(?:press|presses|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)';
  res = res.replace(
    new RegExp(`\\b(${actionVerbs})\\s+(CROSS|SQUARE|TRIANGLE|CIRCLE)\\b`, 'gi'),
    (_, verb, btn) => {
      const b = btn.toUpperCase();
      const badge = b === 'CROSS' ? BADGES.cross : b === 'CIRCLE' ? BADGES.circle : b === 'TRIANGLE' ? BADGES.triangle : BADGES.square;
      return `${verb} ${pushToken(badge)}`;
    }
  );

  // Literal button mentions: CROSS button, `CROSS`, etc.
  res = res.replace(/(?:`CROSS`|CROSS)\s+button/gi, () => `${pushToken(BADGES.cross)} button`);
  res = res.replace(/(?:`SQUARE`|SQUARE)\s+button/gi, () => `${pushToken(BADGES.square)} button`);
  res = res.replace(/(?:`TRIANGLE`|TRIANGLE)\s+button/gi, () => `${pushToken(BADGES.triangle)} button`);
  res = res.replace(/(?:`CIRCLE`|CIRCLE)\s+button/gi, () => `${pushToken(BADGES.circle)} button`);

  // Standalone controller buttons wrapped in backticks
  res = res.replace(/`CROSS`/gi, () => pushToken(BADGES.cross));
  res = res.replace(/`SQUARE`/gi, () => pushToken(BADGES.square));
  res = res.replace(/`TRIANGLE`/gi, () => pushToken(BADGES.triangle));
  res = res.replace(/`CIRCLE`/gi, () => pushToken(BADGES.circle));

  // Triggers & stick clicks: L1, R1, L2, R2, L3, R3
  res = res.replace(/(?:`(L[1-3]|R[1-3])`|\b(L[1-3]|R[1-3])\b)(?:\s+(?:button|trigger))?/gi, (_, g1, g2) => {
    const trigger = (g1 || g2).toUpperCase();
    const title = trigger.includes('3') ? `${trigger} Stick button` : `${trigger} trigger`;
    return pushToken(BADGES.shoulder(trigger, title));
  });

  // START and SELECT buttons in prose
  res = res.replace(/(?:`START`|START)\s+button/gi, () => `${pushToken(BADGES.system('START', 'Start button'))} button`);
  res = res.replace(/(?:`SELECT`|SELECT)\s+button/gi, () => `${pushToken(BADGES.system('SELECT', 'Select button'))} button`);
  res = res.replace(
    new RegExp(`\\b(${actionVerbs})\\s+(START|SELECT)\\b`, 'gi'),
    (_, verb, btn) => {
      const b = btn.toUpperCase();
      return `${verb} ${pushToken(BADGES.system(b, `${b === 'START' ? 'Start' : 'Select'} button`))}`;
    }
  );

  // Reinsert tokens cleanly
  for (let i = 0; i < tokens.length; i++) {
    res = res.replace(`__CTRL_TOK_${i}__`, tokens[i]);
  }

  return res;
}

/** CamelCase words that are real single terms and must not be split. */
const CAMEL_EXCEPTIONS = new Set(['PlayStation']);
const SMALL_WORDS = new Set(['Of', 'The']);

/**
 * Display-only: splits run-together item names ("SluiceGateHandle" -> "Sluice Gate Handle",
 * "TalismanOfLuck" -> "Talisman of Luck"). Source data is never modified.
 */
export function spaceCamelCase(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, (word) => {
    if (CAMEL_EXCEPTIONS.has(word)) return word;
    return word
      .match(/[A-Z][a-z]+/g)!
      .map((w) => (SMALL_WORDS.has(w) ? w.toLowerCase() : w))
      .join(' ');
  });
}

/**
 * Lucide glyphs (ISC licence, lucide.dev) for the five elements plus Light.
 * Inline SVG so prose can carry the icon without a component.
 */
const ELEMENT_ICONS: Record<string, { label: string; paths: string }> = {
  Earth: { label: 'Earth', paths: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>' },
  Wind: {
    label: 'Wind',
    paths: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  },
  Fire: { label: 'Fire', paths: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>' },
  Water: {
    label: 'Water',
    paths: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
  },
  Dark: { label: 'Dark', paths: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>' },
  Light: {
    label: 'Light',
    paths: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  },
};

/** Icon markup for a bolded element name, or '' for any other term. */
function elementIcon(term: string): string {
  const el = ELEMENT_ICONS[term.trim()];
  if (!el) return '';
  return `<svg class="element-icon inline-block w-[1em] h-[1em] mr-1 align-[-0.125em] text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="${el.label} element" role="img">${el.paths}</svg>`;
}

/**
 * Converts standard Markdown emphasis and controller badges for inline text.
 * Escapes raw HTML, tokenizes controller prompts, and applies styled formatting.
 */
export function renderInlineMarkup(text: string | null | undefined): string {
  if (!text) return '';

  // 1. Escape HTML special characters to prevent raw HTML injection
  let html = spaceCamelCase(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Controller button replacement prior to markdown code parsing
  html = formatControllerButtons(html);

  // 3. Inline code / key bindings: `code` -> <kbd>
  html = html.replace(
    /`([^`]+)`/g,
    '<kbd class="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 text-gold-300 border border-slate-700/80 shadow-inner tracking-wide">$1</kbd>'
  );

  // 4. Bold / Strong: **text** or __text__ -> <strong class="highlight-term">.
  // A bolded element name (**Earth**) gets its element icon in front of it.
  html = html.replace(
    /(?:\*\*([^*]+)\*\*|__([^_]+)__)/g,
    (_, bold1, bold2) => {
      const term = bold1 || bold2;
      const icon = elementIcon(term);
      return `<strong class="highlight-term font-semibold text-slate-100">${icon}${term}</strong>`;
    }
  );

  // 5. Italic: *text* or _text_ -> <em>
  html = html.replace(
    /(?:\*([^*]+)\*|_([^_]+)_)/g,
    (_, it1, it2) => `<em class="italic text-slate-200">${it1 || it2}</em>`
  );

  return html;
}

/**
 * Highlight-only markup for wiki prose: escapes HTML, then turns **term** into
 * <strong class="highlight-term">. Unlike renderInlineMarkup it leaves everything else
 * (controller words, _italics_, CamelCase) untouched so verbatim wiki text is not altered.
 */
export function renderHighlights(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="highlight-term">$1</strong>');
}

/** A list nested inside a list item (max 3 levels in total, enforced by the schema). */
export interface RichList {
  list: 'bullet' | 'numbered';
  items: RichListItem[];
}
export interface RichListItem {
  text: string;
  children?: RichList[];
}
export type RichBlock = { text: string } | RichList;
/** Markdown-lite string, or structured blocks with nested lists. */
export type RichText = string | RichBlock[];

const isList = (b: RichBlock): b is RichList => 'list' in b;

/** Plain text of a RichText, one line per paragraph / list item (for matching and search). */
export function richToPlainText(text: RichText | null | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  const out: string[] = [];
  const walkList = (l: RichList) =>
    l.items.forEach((it) => {
      out.push(it.text);
      it.children?.forEach(walkList);
    });
  text.forEach((b) => (isList(b) ? walkList(b) : out.push(b.text)));
  return out.join('\n');
}

const OL_MARKERS = ['decimal', 'lower-alpha', 'lower-roman'];

function listOpenTag(kind: 'ul' | 'ol', level: number): string {
  const margin = level === 0 ? 'my-2' : 'mt-1.5';
  if (kind === 'ul') {
    return `<ul class="gothic-bullets gothic-l${Math.min(level, 2)} space-y-1.5 ${margin} text-slate-200">`;
  }
  const marker = OL_MARKERS[Math.min(level, 2)];
  const base = 'pl-5 space-y-1.5 marker:text-gold-400 marker:font-mono marker:font-semibold text-slate-200';
  return `<ol class="${base} ${margin}" style="list-style-type:${marker}">`;
}

/** Renders structured blocks; `afterLine` anchors depth-first over every paragraph and list item. */
function renderBlocks(blocks: RichBlock[], afterLine: Record<number, string>): string {
  let lineNo = 0;
  const renderList = (l: RichList, level: number): string => {
    const kind = l.list === 'numbered' ? 'ol' : 'ul';
    const lis = l.items.map((it) => {
      const n = ++lineNo;
      const children = (it.children ?? []).map((c) => renderList(c, level + 1)).join('');
      return `  <li class="leading-relaxed">${renderInlineMarkup(it.text)}${children}${afterLine[n] ?? ''}</li>`;
    });
    return `${listOpenTag(kind, level)}\n${lis.join('\n')}\n</${kind}>`;
  };
  return blocks
    .map((b) => {
      if (isList(b)) return renderList(b, 0);
      const n = ++lineNo;
      const tag = afterLine[n] ? 'div' : 'p';
      return `<${tag} class="leading-relaxed">${renderInlineMarkup(b.text)}${afterLine[n] ?? ''}</${tag}>`;
    })
    .join('\n');
}

/**
 * Renders block markdown containing paragraphs, unordered lists, and ordered lists.
 */
export function renderBlockMarkup(
  text: RichText | null | undefined,
  afterLine: Record<number, string> = {}
): string {
  if (!text) return '';
  if (typeof text !== 'string') return renderBlocks(text, afterLine);

  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let lineNo = 0; // 1-based count of non-blank lines, the anchor for `afterLine`
  const inserted = (html: string) => (afterLine[lineNo] ? html + afterLine[lineNo] : html);

  const flushList = () => {
    if (!currentListType || listItems.length === 0) return;
    const tag = currentListType;
    const listClass = tag === 'ul'
      ? 'gothic-bullets gothic-l0 space-y-1.5 my-2 text-slate-200'
      : 'list-decimal pl-5 space-y-1.5 my-2 marker:text-gold-400 marker:font-mono marker:font-semibold text-slate-200';

    blocks.push(
      `<${tag} class="${listClass}">\n${listItems
        .map((li) => `  <li class="leading-relaxed">${li}</li>`)
        .join('\n')}\n</${tag}>`
    );
    currentListType = null;
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    lineNo++;
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

    if (bulletMatch) {
      if (currentListType === 'ol') flushList();
      currentListType = 'ul';
      listItems.push(inserted(renderInlineMarkup(bulletMatch[1])));
    } else if (numberedMatch) {
      if (currentListType === 'ul') flushList();
      currentListType = 'ol';
      listItems.push(inserted(renderInlineMarkup(numberedMatch[2])));
    } else {
      flushList();
      const tag = afterLine[lineNo] ? 'div' : 'p'; // a box is not valid inside <p>
      blocks.push(`<${tag} class="leading-relaxed">${inserted(renderInlineMarkup(trimmed))}</${tag}>`);
    }
  }

  flushList();
  return blocks.join('\n');
}
