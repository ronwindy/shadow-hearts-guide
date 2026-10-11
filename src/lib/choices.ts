import type { StepChoice } from './types';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface ChoiceGroup {
  prompt: number;
  /** 1-based description line the options follow; undefined = end of the step. */
  afterItem?: number;
  choices: StepChoice[];
}

/** Groups a step's choices per prompt (single-prompt dialogues are one group). */
export function groupChoices(choices: StepChoice[] = []): ChoiceGroup[] {
  const groups = new Map<number, ChoiceGroup>();
  for (const c of choices) {
    const key = c.prompt ?? 1;
    let g = groups.get(key);
    if (!g) {
      g = { prompt: key, afterItem: c.after_item, choices: [] };
      groups.set(key, g);
    }
    g.choices.push(c);
  }
  return [...groups.values()];
}

/**
 * Boxes anchored to a description line (`inlineBoxes`, keyed by that line) go right under it;
 * the rest (`tailBoxes`) stay at the end of the step.
 */
export function layoutChoices(choices: StepChoice[] = []): {
  inlineBoxes: Record<number, string>;
  tailBoxes: string[];
} {
  const groups = groupChoices(choices);
  const inlineBoxes: Record<number, string> = {};
  const tailBoxes: string[] = [];
  for (const g of groups) {
    const html = renderChoiceBox(g, groups.length > 1 ? `Prompt ${g.prompt}` : undefined);
    if (g.afterItem) inlineBoxes[g.afterItem] = (inlineBoxes[g.afterItem] ?? '') + html;
    else tailBoxes.push(html);
  }
  return { inlineBoxes, tailBoxes };
}

/** HTML of one choice box; `label` ("Prompt 2") only when the step has several prompts. */
export function renderChoiceBox(group: ChoiceGroup, label?: string): string {
  const items = group.choices
    .map((c) => {
      const cls = c.required ? 'text-gold-300 font-semibold' : 'text-slate-300';
      const req = c.required
        ? '<span class="ml-2 text-[10px] font-mono uppercase tracking-wider text-gold-400">Required</span>'
        : '';
      const outcome = c.outcome
        ? `<span class="block text-xs text-slate-400">${escapeHtml(c.outcome)}</span>`
        : '';
      return `<li class="${cls}"><span>${escapeHtml(c.option)}</span>${req}${outcome}</li>`;
    })
    .join('');
  const head = label
    ? `<p class="text-xs font-mono font-semibold text-slate-400 mb-1.5">${escapeHtml(label)}</p>`
    : '';
  return `<div class="choice-box not-prose my-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 list-none">${head}<ul class="space-y-1 text-sm list-none pl-0">${items}</ul></div>`;
}
