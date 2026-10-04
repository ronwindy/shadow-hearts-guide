/**
 * markup.ts - Safe inline Markdown formatting utility for guide text
 * 
 * Converts standard Markdown emphasis (**bold**, *italic*, `code`) into
 * styled HTML elements while preserving text safety and gothic aesthetics.
 */

export function renderInlineMarkup(text: string | null | undefined): string {
  if (!text) return '';

  // 1. Escape HTML special characters to prevent raw HTML injection
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Inline code / key bindings: `code` -> <kbd>
  html = html.replace(
    /`([^`]+)`/g,
    '<kbd class="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 text-gold-300 border border-slate-700/80 shadow-inner tracking-wide">$1</kbd>'
  );

  // 3. Bold / Strong: **text** or __text__ -> <strong class="highlight-term">
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="highlight-term font-semibold text-slate-100">$1</strong>'
  );
  html = html.replace(
    /__([^_]+)__/g,
    '<strong class="highlight-term font-semibold text-slate-100">$1</strong>'
  );

  // 4. Italic: *text* or _text_ -> <em>
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
