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

  // Button badge rendering helper
  // PS symbols:
  // ✕ (Cross) - Blue: text-sky-400 bg-sky-950/60 border-sky-600/70
  // ◯ (Circle) - Red: text-rose-400 bg-rose-950/60 border-rose-600/70
  // △ (Triangle) - Green: text-emerald-400 bg-emerald-950/60 border-emerald-600/70
  // □ (Square) - Pink/Purple: text-fuchsia-400 bg-fuchsia-950/60 border-fuchsia-600/70

  const crossBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-sky-500/80 text-sky-400 shadow-inner align-baseline" title="CROSS button" aria-label="CROSS button">✕</kbd>`;
  const circleBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-rose-500/80 text-rose-400 shadow-inner align-baseline" title="CIRCLE button" aria-label="CIRCLE button">◯</kbd>`;
  const triangleBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-emerald-500/80 text-emerald-400 shadow-inner align-baseline" title="TRIANGLE button" aria-label="TRIANGLE button">△</kbd>`;
  const squareBadge = `<kbd class="inline-flex items-center justify-center w-5 h-5 mx-0.5 rounded-full font-bold text-xs bg-slate-900 border border-fuchsia-500/80 text-fuchsia-400 shadow-inner align-baseline" title="SQUARE button" aria-label="SQUARE button">□</kbd>`;

  const shoulderBadge = (label: string) =>
    `<kbd class="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 rounded font-mono font-bold text-xs bg-slate-900 border border-gold-500/60 text-gold-300 shadow-inner align-baseline" title="${label} trigger" aria-label="${label}">${label}</kbd>`;

  let res = text;

  // Replace literal button mentions (handling 'CROSS button', 'CROSS', '`CROSS`')
  res = res.replace(/(?:`CROSS`|CROSS)\s+button/gi, `${crossBadge} button`);
  res = res.replace(/(?:`SQUARE`|SQUARE)\s+button/gi, `${squareBadge} button`);
  res = res.replace(/(?:`TRIANGLE`|TRIANGLE)\s+button/gi, `${triangleBadge} button`);
  res = res.replace(/(?:`CIRCLE`|CIRCLE)\s+button/gi, `${circleBadge} button`);

  // Standalone controller buttons wrapped in backticks or specific patterns
  res = res.replace(/`CROSS`/gi, crossBadge);
  res = res.replace(/`SQUARE`/gi, squareBadge);
  res = res.replace(/`TRIANGLE`/gi, triangleBadge);
  res = res.replace(/`CIRCLE`/gi, circleBadge);

  // Standalone words when describing button actions (e.g. "press CROSS", "taps CROSS", "hit CROSS", "with CROSS", "confirm with CROSS")
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+CROSS\b/gi, `$1 ${crossBadge}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+SQUARE\b/gi, `$1 ${squareBadge}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+TRIANGLE\b/gi, `$1 ${triangleBadge}`);
  res = res.replace(/\b(press|tap|taps|tapping|hit|hits|hitting|hold|holding|confirm with|push|pushes)\s+CIRCLE\b/gi, `$1 ${circleBadge}`);

  // Triggers: L1, R1, L2, R2
  res = res.replace(/(?:`L1`|\bL1\b)(?:\s+button|\s+trigger)?/g, `${shoulderBadge('L1')}`);
  res = res.replace(/(?:`R1`|\bR1\b)(?:\s+button|\s+trigger)?/g, `${shoulderBadge('R1')}`);
  res = res.replace(/(?:`L2`|\bL2\b)(?:\s+button|\s+trigger)?/g, `${shoulderBadge('L2')}`);
  res = res.replace(/(?:`R2`|\bR2\b)(?:\s+button|\s+trigger)?/g, `${shoulderBadge('R2')}`);

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
