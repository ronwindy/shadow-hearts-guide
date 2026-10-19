// Presentation only: maps an item name (as written in the source) to a Lucide icon and tint.
// Used by ReferenceTables on a-1-05; unmapped names get no icon. Never affects game facts or QA.
import {
  Leaf, Sprout, Carrot, FlaskConical, Clover, Heart, Brain, Sparkles, Zap, Droplet,
  User, Feather, Wind, Bone, Flame, ScrollText, Coffee, Apple, Soup, Wine,
  GlassWater, Eye, Crosshair, Hourglass, Cat, Mountain, Shell, Bird, Star, Moon,
  Layers, Hand, KeyRound, Key, Dices, Ghost, Dumbbell, HeartPulse, Gauge, Hammer,
  Ticket, Cloud, Tent, BookOpen, Wand, Sword, Target, Orbit, Cross, Cog,
  Flashlight, Gem, Fish, TreePine, DoorOpen, Snowflake, PawPrint, Fence, Baby, BedDouble,
  Club, Diamond, Spade, Circle, CircleDot, CircleDollarSign, Disc3, Lock, Mail, Trophy,
  Warehouse, Projector, Worm, SunMedium, Infinity, Globe, Skull, Bomb, Egg, BookHeart,
  Bookmark, FileText,
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

// Weapons (a-1-02) are grouped per character; every weapon of a character shares that character's weapon-type icon.
const WEAPON_MAP: Record<string, ItemIcon> = {
  Yuri: { icon: Hand, color: GEAR },
  Alice: { icon: BookOpen, color: SEAL },
  Zhuzhen: { icon: Wand, color: FOOD },
  Margarete: { icon: Crosshair, color: SILVER },
  Keith: { icon: Sword, color: REVIVE },
  Halley: { icon: Target, color: CURE },
};

export function getWeaponIcon(character: string): ItemIcon | undefined {
  return WEAPON_MAP[character];
}

export function getItemIcon(name: string): ItemIcon | undefined {
  return MAP[name];
}

// Valuables (a-1-06): one distinct icon per valuable name (the two Book of Rituals / EmigreManuscript rows share theirs).
const VALUABLE_MAP: Record<string, ItemIcon> = {
  "Talisman": { icon: Orbit, color: 'text-gold-400' },
  "Pendant": { icon: Cross, color: 'text-slate-300' },
  "SluiceGateHandle": { icon: Cog, color: 'text-slate-400' },
  "Anti-Cat Powder": { icon: Cat, color: 'text-teal-300' },
  "Torch": { icon: Flashlight, color: 'text-amber-400' },
  "Metal Bowl": { icon: Soup, color: 'text-slate-300' },
  "Jewel": { icon: Gem, color: 'text-cyan-300' },
  "Salt-dried Fish": { icon: Fish, color: 'text-sky-400' },
  "Wood Token": { icon: TreePine, color: 'text-emerald-400' },
  "Yawang Gate Key": { icon: DoorOpen, color: 'text-amber-300' },
  "Wugui Room Key": { icon: Bone, color: 'text-amber-300' },
  "B. Dragon VP": { icon: Snowflake, color: 'text-sky-400' },
  "W. Tiger VP": { icon: PawPrint, color: 'text-slate-300' },
  "B. Tortoise VP": { icon: Shell, color: 'text-slate-400' },
  "R. Phoenix VP": { icon: Bird, color: 'text-rose-300' },
  "East Gate Key": { icon: Fence, color: 'text-amber-300' },
  "Kid's Room Key": { icon: Baby, color: 'text-amber-300' },
  "Guestroom Key": { icon: BedDouble, color: 'text-amber-300' },
  "Heart Key": { icon: Heart, color: 'text-rose-300' },
  "Club Key": { icon: Club, color: 'text-amber-300' },
  "Diamond Key": { icon: Diamond, color: 'text-amber-300' },
  "Spade Key": { icon: Spade, color: 'text-amber-300' },
  "Bronze Coin": { icon: Circle, color: 'text-amber-600' },
  "Silver Coin": { icon: CircleDot, color: 'text-slate-300' },
  "Gold Coin": { icon: CircleDollarSign, color: 'text-gold-400' },
  "Platinum Coin": { icon: Disc3, color: 'text-cyan-300' },
  "Dungeon Key": { icon: Lock, color: 'text-amber-300' },
  "Doyle Letter": { icon: Mail, color: 'text-slate-300' },
  "Oath Grail": { icon: Trophy, color: 'text-gold-400' },
  "Storeroom Key": { icon: Warehouse, color: 'text-amber-300' },
  "Slide": { icon: Projector, color: 'text-slate-400' },
  "Snake Card": { icon: Worm, color: 'text-emerald-400' },
  "Star Card": { icon: Star, color: 'text-gold-400' },
  "Moon Card": { icon: Moon, color: 'text-slate-300' },
  "Sun Card": { icon: SunMedium, color: 'text-amber-400' },
  "Eternity Card": { icon: Infinity, color: 'text-cyan-300' },
  "Earth Gravestone": { icon: Globe, color: 'text-amber-600' },
  "Water Gravestone": { icon: Droplet, color: 'text-sky-400' },
  "Air Gravestone": { icon: Wind, color: 'text-slate-300' },
  "Fire Gravestone": { icon: Flame, color: 'text-orange-400' },
  "Light Gravestone": { icon: Sparkles, color: 'text-yellow-200' },
  "Dark Gravestone": { icon: Skull, color: 'text-violet-400' },
  "DestructionStone": { icon: Bomb, color: 'text-rose-400' },
  "Stone of Rebirth": { icon: Egg, color: 'text-sky-300' },
  "Erotic Book": { icon: BookHeart, color: 'text-rose-300' },
  "Codex of Lurie": { icon: ScrollText, color: 'text-violet-300' },
  "Book of Rituals": { icon: BookOpen, color: 'text-violet-300' },
  "EmigreManuscript": { icon: Bookmark, color: 'text-violet-300' },
  "Pulse Tract": { icon: FileText, color: 'text-violet-300' },
};

export function getValuableIcon(name: string): ItemIcon | undefined {
  return VALUABLE_MAP[name];
}
