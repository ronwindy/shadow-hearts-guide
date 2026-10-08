import {
  Gamepad2, SlidersHorizontal, Swords, Sword, Shield, Package, Heart, Ghost, Save, FolderOpen,
  Sparkles, Flame, Info, Moon, Sun, Droplets, Mountain, Skull, Compass, Tag
} from '@lucide/astro';

export interface BadgeMeta {
  icon: any;
  badgeClass: string;
  label?: string;
}

const FALLBACK = 'bg-slate-900 text-slate-300 border-slate-700/80';
const prettyKey = (key: string) => key.replace(/_/g, ' ');

const SYSTEM: Record<string, BadgeMeta> = {
  starting: { label: 'Starting the Game', icon: Gamepad2, badgeClass: 'bg-amber-950/40 text-amber-300 border-amber-800/50' },
  vibration: { label: 'Controller Vibration', icon: SlidersHorizontal, badgeClass: 'bg-cyan-950/40 text-cyan-300 border-cyan-800/50' },
  saving: { label: 'Saving Data', icon: Save, badgeClass: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' },
  loading: { label: 'Loading Saved Game', icon: FolderOpen, badgeClass: 'bg-sky-950/40 text-sky-300 border-sky-800/50' }
};

const ATTRIBUTE: Record<string, BadgeMeta> = {
  hp: { label: 'HP (Hit Points)', icon: Heart, badgeClass: 'bg-rose-950/50 text-rose-300 border-rose-800/60' },
  mp: { label: 'MP (Magic Points)', icon: Sparkles, badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-800/60' },
  sp: { label: 'SP (Sanity Points)', icon: Ghost, badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-800/60' },
  battle_system: { label: 'Battle System', icon: Swords, badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/60' }
};

const ELEMENT: Record<string, BadgeMeta> = {
  darkness: { icon: Moon, badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-800/60' },
  light: { icon: Sun, badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/60' },
  fire: { icon: Flame, badgeClass: 'bg-orange-950/50 text-orange-300 border-orange-800/60' },
  water: { icon: Droplets, badgeClass: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/60' },
  earth: { icon: Mountain, badgeClass: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' }
};

// Keyword rules: first rule whose keyword appears in the (lower-cased) text wins.
const ACTION_RULES: [string, BadgeMeta][] = [
  ['attack', { icon: Sword, badgeClass: 'bg-rose-950/50 text-rose-300 border-rose-800/60' }],
  ['fusion', { icon: Flame, badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-800/60' }],
  ['item', { icon: Package, badgeClass: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' }],
  ['defend', { icon: Shield, badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-800/60' }]
];
const ACTION_DEFAULT: BadgeMeta = { icon: Swords, badgeClass: 'bg-slate-900 text-gold-400 border-slate-700/80' };

const GLOSSARY_RULES: [string[], BadgeMeta][] = [
  [['graveyard'], { icon: Skull, badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-800/60' }],
  [['exorcist'], { icon: Sparkles, badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/60' }],
  [['malice'], { icon: Flame, badgeClass: 'bg-rose-950/50 text-rose-300 border-rose-800/60' }],
  [['reaper'], { icon: Ghost, badgeClass: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60' }],
  [['yin', 'feng'], { icon: Compass, badgeClass: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' }]
];
const GLOSSARY_DEFAULT: BadgeMeta = { icon: Tag, badgeClass: 'bg-slate-900 text-gold-400 border-slate-700/80' };

const fromKey = (table: Record<string, BadgeMeta>, key: string): BadgeMeta =>
  table[key.toLowerCase()] ?? { label: prettyKey(key), icon: Info, badgeClass: FALLBACK };

export const getSystemMeta = (key: string) => fromKey(SYSTEM, key);
export const getAttributeMeta = (key: string) => fromKey(ATTRIBUTE, key);

export const getElementMeta = (element: string): BadgeMeta =>
  ELEMENT[element.toLowerCase()] ?? { icon: Sparkles, badgeClass: FALLBACK };

export const getActionMeta = (action: string): BadgeMeta => {
  const norm = action.toLowerCase();
  return ACTION_RULES.find(([kw]) => norm.includes(kw))?.[1] ?? ACTION_DEFAULT;
};

export const getGlossaryMeta = (term: string): BadgeMeta => {
  const t = term.toLowerCase();
  return GLOSSARY_RULES.find(([kws]) => kws.some((kw) => t.includes(kw)))?.[1] ?? GLOSSARY_DEFAULT;
};
