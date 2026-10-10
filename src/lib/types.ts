// Centralized type definitions for Shadow Hearts Guide

export interface GuideMetadata {
  game?: string;
  author?: string;
  contact_email?: string;
  facebook?: string;
  region?: string;
  type?: string;
  platform?: string;
  version?: string;
  last_updated?: string;
  best_viewing_program?: string;
}

export interface SectionCallout {
  type: 'tip' | 'warning' | 'info' | string;
  title?: string;
  text: string;
}

export interface TocEntry {
  code: string;
  title: string;
  is_sidequest: boolean;
  id?: string;
  has_structured?: boolean;
  label?: string;
}

export interface TocCategory {
  category: string;
  entries: TocEntry[];
}

export interface TocData {
  guide: {
    id: string;
    code: string;
    title: string;
    type: string;
    category: string;
    source: {
      game: string;
      author: string;
      version: string;
      url: string;
      source_file: string;
    };
    navigation: {
      prev: any;
      next: any;
    };
    overview: {
      sections: TocCategory[];
    };
  };
}

export interface HeaderData {
  guide: {
    id: string;
    code: string;
    title: string;
    type: string;
    category: string;
    source: {
      game: string;
      author: string;
      version: string;
      url: string;
      source_file: string;
    };
    navigation: {
      prev: any;
      next: {
        id: string;
        code: string;
        title: string;
        file: string;
      };
    };
    overview: {
      metadata: GuideMetadata;
      purpose: string;
      guide_scope: string;
    };
    callouts?: SectionCallout[];
  };
}

export interface ObtainableItem {
  name: string;
  category?: 'equipment' | 'valuables' | 'consumable' | 'special' | string;
  location: string;
}

export interface ItemsSummary {
  obtainable?: ObtainableItem[];
  total_count?: number;
  missable_count?: number;
}

export interface EnemyInfo {
  number?: number | string;
  name: string;
  class?: string;
  hp?: number | string;
  mp?: number | string;
  notes?: string;
  is_boss?: boolean;
  is_subboss?: boolean;
}

export interface BossEnemy {
  name: string;
  hp?: number | string;
  class?: string;
  drop?: string;
}

export interface BossPartyMember {
  name: string;
  level?: number | string;
}

export interface BossData {
  type?: string;
  name: string;
  exp?: number | string;
  cash?: number | string;
  enemies?: BossEnemy[];
  party?: BossPartyMember[];
  strategy?: string;
}

export interface ShopInventoryItem {
  name: string;
  price: number | string;
}

export interface ShopInfo {
  name: string;
  inventory?: ShopInventoryItem[];
}

export interface StepReward {
  name: string;
  category?: string;
  matched_overview_item?: string;
}

export interface StepNoteBadge {
  label: string;
  range: string;
  color?: string;
}

export interface StepNoteTableRow {
  range: string;
  reward: string;
  is_unique?: boolean;
  category?: string;
}

export interface StepNoteTable {
  headers: string[];
  rows: StepNoteTableRow[];
}

export interface StepNote {
  type?: string;
  title?: string;
  text: string;
  badges?: StepNoteBadge[];
  table?: StepNoteTable;
}

export interface StepChecklistItem {
  id: number | string;
  step_number?: number | string;
  title?: string;
  description?: string;
  instruction?: string;
  type?: string;
  boss?: BossData;
  rewards?: (StepReward | string)[];
  encounter?: {
    enemies?: string[];
  };
  notes?: StepNote[];
}

export interface CharacterProfile {
  name: string;
  class?: string;
  age?: number | string;
  profile: string;
}

export interface GlossaryTerm {
  term: string;
  description: string;
}

export interface DirectionMapping {
  screen: string;
  cardinal: string;
  abbr: string;
}

export interface ControllerInput {
  button: string;
  function: string;
}

export interface BattleAction {
  action: string;
  description: string;
}

export interface JudgmentRingInfo {
  description: string;
  mechanics: string;
  character_variation?: string;
}

export interface ManualOverviewData {
  intro?: string;
  objective?: string;
  route?: string[];
  directions?: {
    compass_note?: string;
    mappings?: DirectionMapping[];
  };
  story_prologue?: {
    setting_1?: string;
    setting_2?: string;
    inciting_incident?: string;
  };
  controls?: {
    controller_layout?: ControllerInput[];
    menu_navigation?: string;
  };
  playing_the_game?: Record<string, string>;
  player_attributes?: Record<string, string>;
  battle_mechanics?: {
    encounter_flow?: string;
    action_menu?: BattleAction[];
    judgment_ring?: JudgmentRingInfo;
    command_menu?: string;
  };
  characters?: CharacterProfile[];
  glossary?: GlossaryTerm[];
  metadata?: GuideMetadata;
  purpose?: string;
  guide_scope?: string;
  sections?: TocCategory[];
}

export interface InitialPartySetup {
  character?: string;
  note?: string;
  equipment?: string[];
  valuables?: string[];
  souls?: string[];
}

export interface NavigationLink {
  id: string;
  code?: string;
  title: string;
  file?: string;
}

export interface PageTocItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Article image extracted from the wiki source (file lives under public/).
 */
export interface WikiImage {
  /** Path relative to the site base, e.g. "wiki/dvd.webp" or "characters/Yuri.webp". */
  file: string;
  alt: string;
  caption: string;
  width?: number;
  height?: number;
}

/**
 * Hyperlink carried over from the wiki source.
 */
export interface WikiLink {
  text: string;
  href: string;
}

/**
 * A titled block of verbatim wiki prose, optionally with a bullet list and notes.
 */
export interface WikiTextSection {
  id: string;
  title: string;
  /** "For the series..." / "Main article: ..." lines, verbatim. */
  notes?: string[];
  image?: WikiImage;
  paragraphs: string[];
  /** Bullet items; `lead` is the opening words of `text` rendered in bold, `rest` is the remainder. */
  items?: Array<{ lead: string; rest: string }>;
}

/**
 * Playable character entry. `text` is the wiki entry verbatim.
 */
export interface WikiCharacter {
  name: string;
  text: string;
  portrait?: WikiImage;
}

/**
 * One voice-cast line: "Actor — Role, Role". `roles` is empty when the source line has no role.
 */
export interface WikiVoiceCredit {
  actor: string;
  roles: string;
  raw: string;
}

export interface WikiVoiceCast {
  intro: string;
  credits: WikiVoiceCredit[];
}

export interface WikiGalleryGroup {
  title: string;
  images: WikiImage[];
}

/**
 * Source irregularity preserved and flagged rather than corrected.
 */
export interface WikiSourceFlag {
  id: string;
  note: string;
}

/**
 * Complete Game Wiki Overview schema representing structured-content/game-wiki-overview.json.
 * Built deterministically from canonical-sources/game-wiki-fandom.canonical.json
 * (scripts/build_wiki_structured.py); Plot and Non Playable Characters are out of scope here.
 */
export interface GameWikiData {
  id: string;
  title: string;
  source: { url: string; file: string; license_note: string };
  intro: { notes: string[]; image?: WikiImage; paragraphs: string[] };
  gameplay: { paragraphs: string[]; sections: WikiTextSection[] };
  characters: { playable: WikiCharacter[] };
  development: { paragraphs: string[]; sections: WikiTextSection[] };
  media_audio: {
    media: WikiTextSection;
    audio: WikiTextSection;
    voice_acting: { english: WikiVoiceCast; japanese: WikiVoiceCast };
    soundtrack: WikiTextSection;
    production_credits: WikiTextSection;
  };
  reception: { paragraphs: string[]; footnote?: WikiLink };
  gallery: WikiGalleryGroup[];
  external_links: WikiLink[];
  flags: WikiSourceFlag[];
}

/**
 * Shape of a structured section's `guide` object. Walkthrough and reference
 * sections share this loose schema; every field is optional.
 */
export interface GuideContent {
  id?: string;
  code?: string;
  title?: string;
  category?: string;
  navigation?: { prev?: NavigationLink; next?: NavigationLink };
  overview?: ManualOverviewData;
  callouts?: SectionCallout[];
  objectives?: string[];
  route?: string[];
  initial_setup?: InitialPartySetup;
  items_summary?: ItemsSummary;
  enemies?: EnemyInfo[];
  boss?: BossData;
  bosses?: BossData[];
  shops?: ShopInfo[];
  reference_blocks?: any[];
  steps?: StepChecklistItem[];
}
