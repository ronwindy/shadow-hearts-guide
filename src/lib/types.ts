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
 * Publisher metadata for regional releases.
 */
export interface GamePublisher {
  region: string;
  publisher: string;
}

/**
 * Release date record for regional launches.
 */
export interface GameReleaseDate {
  region: string;
  date: string;
}

/**
 * Production and publishing metadata for Shadow Hearts.
 */
export interface GameInfo {
  title: string;
  developer: string;
  publishers: GamePublisher[];
  director: string;
  producer: string;
  designer: string;
  artist: string;
  writer: string;
  composers: string[];
  series: string;
  platform: string;
  release_dates: GameReleaseDate[];
  genre: string;
  mode: string;
}

/**
 * Historical setting, premise, and narrative roots.
 */
export interface WikiOverview {
  premise: string;
  historical_setting: string;
  spiritual_lineage: string;
}

/**
 * Core mechanics breakdown for the Judgement Ring.
 */
export interface WikiJudgementRing {
  name: string;
  description: string;
  mechanics: string;
  variations: string;
}

/**
 * Mechanics breakdown for Sanity Points and Malice accumulation.
 */
export interface WikiSanitySystem {
  name: string;
  sp_mechanics: string;
  malice_mechanics: string;
}

/**
 * Mechanics breakdown for Demon Fusion and the Graveyard realm.
 */
export interface WikiFusionSystem {
  name: string;
  description: string;
  mechanics: string;
}

/**
 * Consolidated gameplay systems.
 */
export interface WikiGameplay {
  exploration_and_encounters: string;
  judgement_ring: WikiJudgementRing;
  sanity_system: WikiSanitySystem;
  fusion_system: WikiFusionSystem;
}

/**
 * Playable character encyclopedia profile.
 */
export interface WikiCharacter {
  name: string;
  japanese_name: string;
  role: string;
  element_or_weapon: string;
  bio: string;
}

/**
 * Critical review citation and verdict.
 */
export interface WikiReviewHighlight {
  publication: string;
  reviewer?: string;
  verdict: string;
}

/**
 * Critical reception, sales, and franchise legacy.
 */
export interface WikiReception {
  sales: string;
  critical_overview: string;
  highlights: WikiReviewHighlight[];
  soundtrack: string;
  legacy: string;
}

/**
 * Complete Game Wiki Overview schema representing structured-content/game-wiki-overview.json.
 */
export interface GameWikiData {
  id: string;
  title: string;
  game_info: GameInfo;
  overview: WikiOverview;
  gameplay: WikiGameplay;
  characters: WikiCharacter[];
  reception_and_legacy: WikiReception;
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
