// Presentation only: maps an item name (as written in the source) to a Lucide icon and tint.
// Used by ReferenceTables on a-1-05; unmapped names get no icon. Never affects game facts or QA.
import {
  Leaf, Sprout, Carrot, FlaskConical, Clover, Heart, Brain, Sparkles, Zap, Droplet, User, Feather,
  Wind, Bone, Flame, ScrollText, Coffee, Apple, Soup, Wine, GlassWater, Eye, Crosshair, Hourglass,
  Cat, Mountain, Shell, Bird, Star, Moon, Layers, Hand, KeyRound, Key, Dices, Ghost, Dumbbell,
  HeartPulse, Gauge, Hammer, Ticket, Cloud, Tent,
} from '@lucide/astro';

type IconComponent = typeof Leaf;
export interface ItemIcon {
  icon: IconComponent;
  color: string;
}

// Family tints: HP = green, MP = blue, SP = violet, revive = rose, cures = amber, tea/food = teal,
// ring/battle gear = slate/gold, seals = sky, misc = slate.
const HP = 'text-emerald-400';
const MP = 'text-sky-400';
const SP = 'text-violet-400';
const REVIVE = 'text-rose-300';
const CURE = 'text-amber-400';
const FOOD = 'text-teal-300';
const GEAR = 'text-gold-400';
const SILVER = 'text-slate-300';
const SEAL = 'text-cyan-300';
const MISC = 'text-slate-400';

const MAP: Record<string, ItemIcon> = {
  'Thera Leaf': { icon: Leaf, color: HP },
  'Thera Seed': { icon: Sprout, color: HP },
  'Thera Root': { icon: Carrot, color: HP },
  'Thera Extract': { icon: FlaskConical, color: HP },
  'Mana Leaf': { icon: Leaf, color: MP },
  'Mana Seed': { icon: Sprout, color: MP },
  'Mana Root': { icon: Carrot, color: MP },
  'Mana Extract': { icon: FlaskConical, color: MP },
  'Pure Leaf': { icon: Leaf, color: SP },
  'Pure Seed': { icon: Sprout, color: SP },
  'Pure Root': { icon: Carrot, color: SP },
  'Pure Extract': { icon: FlaskConical, color: SP },
  'TalismanOfLuck': { icon: Clover, color: REVIVE },
  'TalismanOfMercy': { icon: Heart, color: REVIVE },
  'TalismanOfWisdom': { icon: Brain, color: REVIVE },
  'TalismanOfPurity': { icon: Sparkles, color: REVIVE },
  'TalismanOfPower': { icon: Zap, color: REVIVE },
  "Mermaid's Tear": { icon: Droplet, color: CURE },
  'Holy Mother Bust': { icon: User, color: CURE },
  "Angel's Feather": { icon: Feather, color: CURE },
  "Faerie's Sigh": { icon: Wind, color: CURE },
  "Imp's Fang": { icon: Bone, color: CURE },
  'Phoenix Tail': { icon: Flame, color: CURE },
  'Soul Benediction': { icon: ScrollText, color: CURE },
  'TeaOfTheHealer': { icon: Coffee, color: FOOD },
  'TeaOfTheSage': { icon: Coffee, color: FOOD },
  'TeaOfTheHolyOne': { icon: Coffee, color: FOOD },
  'Fruit of Yggdrasil': { icon: Apple, color: FOOD },
  "Witch's Broth": { icon: Soup, color: FOOD },
  "Priest's Wine": { icon: Wine, color: FOOD },
  "Alchemist'sWater": { icon: GlassWater, color: FOOD },
  'Eye of Ouroboros': { icon: Eye, color: FOOD },
  'Bronze Arrowhead': { icon: Crosshair, color: GEAR },
  'Silver Hourglass': { icon: Hourglass, color: SILVER },
  'Gold Hourglass': { icon: Hourglass, color: GEAR },
  'W.Tiger Hair': { icon: Cat, color: GEAR },
  'B.Dragon Horn': { icon: Mountain, color: GEAR },
  'B.Tortoise Fang': { icon: Shell, color: GEAR },
  'R.Phoenix Talon': { icon: Bird, color: GEAR },
  'Star Swallow': { icon: Star, color: GEAR },
  'Moon Swallow': { icon: Moon, color: GEAR },
  'Kirin Scale': { icon: Layers, color: GEAR },
  'Monkey Paw': { icon: Hand, color: GEAR },
  'Silver Hand': { icon: Hand, color: SILVER },
  'Key to Success': { icon: KeyRound, color: GEAR },
  'Dice of Caesar': { icon: Dices, color: GEAR },
  'Third Key': { icon: Key, color: GEAR },
  'Fifth Key': { icon: Key, color: GEAR },
  'Seventh Key': { icon: Key, color: GEAR },
  'Seal of Life': { icon: Heart, color: SEAL },
  'Seal of Aura': { icon: Sparkles, color: SEAL },
  'Seal of the Soul': { icon: Ghost, color: SEAL },
  'Seal of Strength': { icon: Dumbbell, color: SEAL },
  'Seal of Vitality': { icon: HeartPulse, color: SEAL },
  'Seal of Speed': { icon: Gauge, color: SEAL },
  'Seal of Wisdom': { icon: Brain, color: SEAL },
  'Seal of Force': { icon: Hammer, color: SEAL },
  'Seal of Luck': { icon: Clover, color: SEAL },
  'Lottery Ticket': { icon: Ticket, color: MISC },
  'Tissues': { icon: Cloud, color: MISC },
  'Tent': { icon: Tent, color: MISC },
};

export function getItemIcon(name: string): ItemIcon | undefined {
  return MAP[name];
}
