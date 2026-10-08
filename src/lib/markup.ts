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

  // 4. Bold / Strong: **text** or __text__ -> <strong class="highlight-term">
  html = html.replace(
    /(?:\*\*([^*]+)\*\*|__([^_]+)__)/g,
    (_, bold1, bold2) => `<strong class="highlight-term font-semibold text-slate-100">${bold1 || bold2}</strong>`
  );

  // 5. Italic: *text* or _text_ -> <em>
  html = html.replace(
    /(?:\*([^*]+)\*|_([^_]+)_)/g,
    (_, it1, it2) => `<em class="italic text-slate-200">${it1 || it2}</em>`
  );

  return html;
}

/**
 * Renders block markdown containing paragraphs, unordered lists, and ordered lists.
 */
export function renderBlockMarkup(text: string | null | undefined): string {
  if (!text) return '';

  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!currentListType || listItems.length === 0) return;
    const tag = currentListType;
    const listClass = tag === 'ul'
      ? 'list-disc pl-5 space-y-1.5 my-2 marker:text-gold-400 text-slate-200'
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

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);

    if (bulletMatch) {
      if (currentListType === 'ol') flushList();
      currentListType = 'ul';
      listItems.push(renderInlineMarkup(bulletMatch[1]));
    } else if (numberedMatch) {
      if (currentListType === 'ul') flushList();
      currentListType = 'ol';
      listItems.push(renderInlineMarkup(numberedMatch[2]));
    } else {
      flushList();
      blocks.push(`<p class="leading-relaxed">${renderInlineMarkup(trimmed)}</p>`);
    }
  }

  flushList();
  return blocks.join('\n');
}
