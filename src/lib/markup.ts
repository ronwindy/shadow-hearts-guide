/**
 * markup.ts - Safe Markdown and game controller formatting utility for guide text
 * 
 * Converts standard Markdown emphasis (**bold**, *italic*, `code`), list items,
 * and PlayStation controller button prompts (CROSS -> ✕, CIRCLE -> ◯, etc.) into
 * richly styled HTML elements while preserving text safety and gothic aesthetics.
 */

/**
 * Maps PlayStation button tokens to stylized badge HTML representations.
 */
export function formatControllerButtons(text: string): string {
  if (!text) return '';

  const badges: string[] = [];
  const tokenFor = (html: string) => {
    const idx = badges.length;
    badges.push(html);
    return `__CTRL_BTN_${idx}__`;
  };

  const crossBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-sky-500/80 text-sky-400 shadow-inner align-baseline" title="CROSS button" aria-label="CROSS button">✕</kbd>`;
  const circleBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-rose-500/80 text-rose-400 shadow-inner align-baseline" title="CIRCLE button" aria-label="CIRCLE button">◯</kbd>`;
  const triangleBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-emerald-500/80 text-emerald-400 shadow-inner align-baseline" title="TRIANGLE button" aria-label="TRIANGLE button">△</kbd>`;
  const squareBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-fuchsia-500/80 text-fuchsia-400 shadow-inner align-baseline" title="SQUARE button" aria-label="SQUARE button">□</kbd>`;

  const shoulderBadge = (label: string, title?: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-gold-500/60 text-gold-300 shadow-inner align-baseline" title="${title || `${label} trigger`}" aria-label="${label}">${label}</kbd>`;

  const dpadBadge = (arrow: string, label: string) =>
    `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-600/80 text-amber-300 shadow-inner align-baseline" title="D-Pad ${label}" aria-label="D-Pad ${label}">${arrow}</kbd>`;

  const analogBadge = (label: string, title: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-cyan-500/60 text-cyan-300 shadow-inner align-baseline" title="${title}" aria-label="${title}">${label}</kbd>`;

  const systemBadge = (label: string, title: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-slate-700/80 text-slate-300 shadow-inner align-baseline" title="${title}" aria-label="${title}">${label}</kbd>`;

  let res = text;

  // 1. Controller layout composite strings in table (e.g. "/\\ (TRIANGLE)", "[] (SQUARE)", ">< (CROSS)", "() (CIRCLE)")
  // Note: HTML entity escaping happens before formatControllerButtons, so < and > are &lt; and &gt;
  res = res.replace(/(?:&gt;&lt;|><)\s*\(\s*CROSS\s*\)/gi, () => tokenFor(crossBadge));
  res = res.replace(/(?:\/\\|\/\\\\)\s*\(\s*TRIANGLE\s*\)/gi, () => tokenFor(triangleBadge));
  res = res.replace(/\[\]\s*\(\s*SQUARE\s*\)/gi, () => tokenFor(squareBadge));
  res = res.replace(/\(\)\s*\(\s*CIRCLE\s*\)/gi, () => tokenFor(circleBadge));

  // Analog sticks composite strings (e.g. "LA (LEFT ANALOG)", "RA (RIGHT ANALOG)")
  res = res.replace(/\bLA\s*\(\s*LEFT\s+ANALOG\s*\)/gi, () => tokenFor(analogBadge('L-Stick', 'Left Analog stick')));
  res = res.replace(/\bRA\s*\(\s*RIGHT\s+ANALOG\s*\)/gi, () => tokenFor(analogBadge('R-Stick', 'Right Analog stick')));

  // Stick press (e.g. "L3 (Press)", "R3 (Press)")
  res = res.replace(/\bL3\s*\(\s*Press\s*\)/gi, () => tokenFor(shoulderBadge('L3', 'L3 Stick button')));
  res = res.replace(/\bR3\s*\(\s*Press\s*\)/gi, () => tokenFor(shoulderBadge('R3', 'R3 Stick button')));

  // System button composite strings (e.g. "SL (SELECT)", "ST (START)")
  res = res.replace(/\bSL\s*\(\s*SELECT\s*\)/gi, () => tokenFor(systemBadge('SELECT', 'Select button')));
  res = res.replace(/\bST\s*\(\s*START\s*\)/gi, () => tokenFor(systemBadge('START', 'Start button')));

  // 2. Exact D-Pad abbreviations when isolated or standalone in button columns
  res = res.replace(/^UP$/g, () => tokenFor(dpadBadge('▲', 'Up')));
  res = res.replace(/^DN$/g, () => tokenFor(dpadBadge('▼', 'Down')));
  res = res.replace(/^LT$/g, () => tokenFor(dpadBadge('◀', 'Left')));
  res = res.replace(/^RT$/g, () => tokenFor(dpadBadge('▶', 'Right')));

  // D-Pad inside text phrases: "D-Pad UP", "DPAD UP", "D-pad (UP)"
  res = res.replace(/\b(?:D-Pad|DPAD)\s+UP\b/gi, () => `D-Pad ${tokenFor(dpadBadge('▲', 'Up'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+DN\b/gi, () => `D-Pad ${tokenFor(dpadBadge('▼', 'Down'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+LT\b/gi, () => `D-Pad ${tokenFor(dpadBadge('◀', 'Left'))}`);
  res = res.replace(/\b(?:D-Pad|DPAD)\s+RT\b/gi, () => `D-Pad ${tokenFor(dpadBadge('▶', 'Right'))}`);

  // Analog stick abbreviations when isolated
  res = res.replace(/^LA$/g, () => tokenFor(analogBadge('L-Stick', 'Left Analog stick')));
  res = res.replace(/^RA$/g, () => tokenFor(analogBadge('R-Stick', 'Right Analog stick')));
  res = res.replace(/^AG$/g, () => tokenFor(systemBadge('ANALOG', 'Toggle Analog mode')));

  // Select / Start when isolated
  res = res.replace(/^SELECT$/g, () => tokenFor(systemBadge('SELECT', 'Select button')));
  res = res.replace(/^START$/g, () => tokenFor(systemBadge('START', 'Start button')));

  // 3. Replace literal button mentions (handling 'CROSS button', 'CROSS', '`CROSS`')
  res = res.replace(/(?:`CROSS`|CROSS)\s+button/gi, () => `${tokenFor(crossBadge)} button`);
  res = res.replace(/(?:`SQUARE`|SQUARE)\s+button/gi, () => `${tokenFor(squareBadge)} button`);
  res = res.replace(/(?:`TRIANGLE`|TRIANGLE)\s+button/gi, () => `${tokenFor(triangleBadge)} button`);
  res = res.replace(/(?:`CIRCLE`|CIRCLE)\s+button/gi, () => `${tokenFor(circleBadge)} button`);

  // Standalone controller buttons wrapped in backticks or specific patterns
  res = res.replace(/`CROSS`/gi, () => tokenFor(crossBadge));
  res = res.replace(/`SQUARE`/gi, () => tokenFor(squareBadge));
  res = res.replace(/`TRIANGLE`/gi, () => tokenFor(triangleBadge));
  res = res.replace(/`CIRCLE`/gi, () => tokenFor(circleBadge));

  // Standalone words when describing button actions (e.g. "press CROSS", "taps CROSS", "hit CROSS", "with CROSS", "confirm with CROSS")
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+CROSS\b/gi, (_, verb) => `${verb} ${tokenFor(crossBadge)}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+SQUARE\b/gi, (_, verb) => `${verb} ${tokenFor(squareBadge)}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+TRIANGLE\b/gi, (_, verb) => `${verb} ${tokenFor(triangleBadge)}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+CIRCLE\b/gi, (_, verb) => `${verb} ${tokenFor(circleBadge)}`);

  // Triggers & stick clicks: L1, R1, L2, R2, L3, R3
  res = res.replace(/(?:`L1`|\bL1\b)(?:\s+button|\s+trigger)?/g, () => tokenFor(shoulderBadge('L1')));
  res = res.replace(/(?:`R1`|\bR1\b)(?:\s+button|\s+trigger)?/g, () => tokenFor(shoulderBadge('R1')));
  res = res.replace(/(?:`L2`|\bL2\b)(?:\s+button|\s+trigger)?/g, () => tokenFor(shoulderBadge('L2')));
  res = res.replace(/(?:`R2`|\bR2\b)(?:\s+button|\s+trigger)?/g, () => tokenFor(shoulderBadge('R2')));
  res = res.replace(/(?:`L3`|\bL3\b)(?:\s+button)?/g, () => tokenFor(shoulderBadge('L3', 'L3 Stick button')));
  res = res.replace(/(?:`R3`|\bR3\b)(?:\s+button)?/g, () => tokenFor(shoulderBadge('R3', 'R3 Stick button')));

  // START and SELECT buttons in prose (e.g. "START button", "SELECT button", "press START")
  res = res.replace(/(?:`START`|START)\s+button/gi, () => `${tokenFor(systemBadge('START', 'Start button'))} button`);
  res = res.replace(/(?:`SELECT`|SELECT)\s+button/gi, () => `${tokenFor(systemBadge('SELECT', 'Select button'))} button`);
  res = res.replace(/\b(press|presses|hit|hits)\s+START\b/gi, (_, verb) => `${verb} ${tokenFor(systemBadge('START', 'Start button'))}`);
  res = res.replace(/\b(press|presses|hit|hits)\s+SELECT\b/gi, (_, verb) => `${verb} ${tokenFor(systemBadge('SELECT', 'Select button'))}`);

  // Substitute tokens back with actual badge HTML
  for (let i = 0; i < badges.length; i++) {
    res = res.replace(`__CTRL_BTN_${i}__`, badges[i]);
  }

  return res;
}

/**
 * Converts standard Markdown emphasis and controller badges for inline text.
 */
export function renderInlineMarkup(text: string | null | undefined): string {
  if (!text) return '';

  // 1. Escape HTML special characters to prevent raw HTML injection
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Controller button replacement prior to kbd rendering
  html = formatControllerButtons(html);

  // 3. Inline code / key bindings: `code` -> <kbd>
  html = html.replace(
    /`([^`]+)`/g,
    '<kbd class="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 text-gold-300 border border-slate-700/80 shadow-inner tracking-wide">$1</kbd>'
  );

  // 4. Bold / Strong: **text** or __text__ -> <strong class="highlight-term">
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="highlight-term font-semibold text-slate-100">$1</strong>'
  );
  html = html.replace(
    /__([^_]+)__/g,
    '<strong class="highlight-term font-semibold text-slate-100">$1</strong>'
  );

  // 5. Italic: *text* or _text_ -> <em>
  html = html.replace(
    /\*([^*]+)\*/g,
    '<em class="italic text-slate-200">$1</em>'
  );
  html = html.replace(
    /_([^_]+)_/g,
    '<em class="italic text-slate-200">$1</em>'
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
    if (currentListType === 'ul') {
      blocks.push(
        `<ul class="list-disc pl-5 space-y-1.5 my-2 marker:text-gold-400 text-slate-200">\n${listItems
          .map((li) => `  <li class="leading-relaxed">${li}</li>`)
          .join('\n')}\n</ul>`
      );
    } else {
      blocks.push(
        `<ol class="list-decimal pl-5 space-y-1.5 my-2 marker:text-gold-400 marker:font-mono marker:font-semibold text-slate-200">\n${listItems
          .map((li) => `  <li class="leading-relaxed">${li}</li>`)
          .join('\n')}\n</ol>`
      );
    }
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

    // Match unordered list: -, *, or •
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    // Match ordered list: 1., 2., etc.
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
      // Regular paragraph or line
      blocks.push(`<p class="leading-relaxed">${renderInlineMarkup(trimmed)}</p>`);
    }
  }

  flushList();

  return blocks.join('\n');
}
