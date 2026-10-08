import fs from 'node:fs';
import path from 'node:path';
import type {
  GuideMetadata,
  HeaderData,
  TocEntry,
  TocCategory,
  TocData,
  PageTocItem,
  ManualOverviewData,
  GameWikiData
} from './types';

export * from './types';

export function getHumanReadableLabel(
  rawCode: string = '',
  category: string = '',
  isSidequest: boolean = false
): string {
  const code = (rawCode || '').trim().replace(/^\[|\]$/g, '').toUpperCase();

  if (code === 'HEADER') return 'Guide Overview';
  if (code === 'I-1-00') return 'Directory';
  if (code === 'I-1-01') return 'Game Manual';
  if (code === 'W-1-00') return 'Asia Overview';
  if (code === 'W-2-00') return 'Europe Overview';
  if (code === 'A-1-00') return 'Appendices Overview';

  // Walkthrough Side Quests: W-S-01 .. W-S-16
  const sideMatch = code.match(/^W-S-(\d+)$/);
  if (sideMatch) {
    const num = sideMatch[1];
    return `Side Quest ${num}`;
  }

  // Walkthrough Asia: W-1-01 .. W-1-11
  const asiaMatch = code.match(/^W-1-(\d+)$/);
  if (asiaMatch) {
    const num = asiaMatch[1];
    return `Part ${num}`;
  }

  // Walkthrough Europe: W-2-01 .. W-2-18
  const europeMatch = code.match(/^W-2-(\d+)$/);
  if (europeMatch) {
    const num = europeMatch[1];
    return `Part ${num}`;
  }

  // Appendices: A-1-01 .. A-1-15
  const appMatch = code.match(/^A-1-(\d+)$/);
  if (appMatch) {
    const num = appMatch[1];
    return `Appendix ${num}`;
  }

  // Conclusion: C-1-01 .. C-1-03
  if (code === 'C-1-01') return 'Version History';
  if (code === 'C-1-02') return 'Acknowledgements';
  if (code === 'C-1-03') return 'Credits & Legal';

  if (isSidequest) return 'Side Quest';
  if (category) return category;
  return rawCode;
}

const SECTIONS_DIR = path.resolve(process.cwd(), 'structured-content/sections');

export function getHeaderData(): HeaderData {
  const filePath = path.join(SECTIONS_DIR, 'header-title-metadata-intro-notes.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function enrichTocCategories(categories: TocCategory[], files: string[]): TocCategory[] {
  categories.forEach((cat) => {
    cat.entries.forEach((entry) => {
      const cleanCode = entry.code.toLowerCase().replace(/\[|\]/g, '');
      const match = files.find((f) => {
        const lower = f.toLowerCase();
        return lower.startsWith(cleanCode);
      });

      entry.label = getHumanReadableLabel(entry.code, cat.category, entry.is_sidequest);

      if (match) {
        entry.has_structured = true;
        entry.id = cleanCode;
      } else {
        entry.id = cleanCode;
      }
    });
  });
  return categories;
}

export function getTocData(): TocData {
  const filePath = path.join(SECTIONS_DIR, 'i-1-00-table-of-contents.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: TocData = JSON.parse(raw);

  const files = fs.readdirSync(SECTIONS_DIR);
  enrichTocCategories(data.guide.overview.sections, files);

  return data;
}

export function getAllStructuredSections(): Array<{ id: string; filename: string; data: any }> {
  if (!fs.existsSync(SECTIONS_DIR)) return [];
  const files = fs.readdirSync(SECTIONS_DIR).filter((f: string) => f.endsWith('.json'));
  return files.map((filename: string) => {
    const filePath = path.join(SECTIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (data.guide?.overview?.sections) {
      enrichTocCategories(data.guide.overview.sections, files);
    }
    const id = data.guide?.id || filename.replace('.json', '');
    return { id, filename, data };
  });
}

/**
 * Builds the array of jump sections for on-page table of contents (right sidebar & mobile drawer)
 */
export function buildPageTocSections(guide: any): PageTocItem[] {
  const overview: ManualOverviewData = guide.overview || {};
  const objectives = guide.objectives || (overview.objective ? [overview.objective] : []);
  const route = guide.route || overview.route || [];
  const steps = guide.steps || [];
  const initialSetup = guide.initial_setup;
  const itemsSummary = guide.items_summary;
  const enemies = guide.enemies || [];
  const shops = guide.shops || [];

  const pageSections: PageTocItem[] = [];

  if (objectives && objectives.length > 0) {
    pageSections.push({ id: 'objectives', label: 'Primary Objectives', count: objectives.length });
  }
  if (route && route.length > 0) {
    pageSections.push({ id: 'route', label: 'Route Progression' });
  }
  if (initialSetup) {
    pageSections.push({ id: 'setup', label: 'Initial Setup' });
  }
  if (steps && steps.length > 0) {
    pageSections.push({ id: 'steps', label: 'Walkthrough Steps', count: steps.length });
  }
  if (itemsSummary?.obtainable && itemsSummary.obtainable.length > 0) {
    pageSections.push({ id: 'items', label: 'Obtainable Items', count: itemsSummary.obtainable.length });
  }
  if (enemies && enemies.length > 0) {
    pageSections.push({ id: 'enemies', label: 'Area Enemies', count: enemies.length });
  }
  if (shops && shops.length > 0) {
    pageSections.push({ id: 'shops', label: 'Shops & Merchants', count: shops.length });
  }
  if (guide.reference_blocks && guide.reference_blocks.length > 0) {
    pageSections.push({ id: 'reference', label: 'Reference Tables' });
  }
  if (overview.sections && overview.sections.length > 0) {
    pageSections.push({ id: 'toc-index', label: 'Guide Directory' });
  }
  if (overview.directions) {
    pageSections.push({ id: 'compass', label: 'Compass & Navigation' });
  }
  if (overview.story_prologue) {
    pageSections.push({ id: 'prologue', label: 'Story Prologue' });
  }
  if (overview.controls) {
    pageSections.push({ id: 'controls', label: 'Controls' });
  }
  if (overview.playing_the_game) {
    pageSections.push({ id: 'system', label: 'System & Operations' });
  }
  if (overview.player_attributes) {
    pageSections.push({ id: 'attributes', label: 'Attributes & Battle' });
  }
  if (overview.battle_mechanics) {
    pageSections.push({ id: 'battle-mechanics', label: 'Battle Mechanics' });
  }
  if (overview.characters && overview.characters.length > 0) {
    pageSections.push({ id: 'characters', label: 'Character Profiles', count: overview.characters.length });
  }
  if (overview.glossary && overview.glossary.length > 0) {
    pageSections.push({ id: 'glossary', label: 'Lore & Glossary', count: overview.glossary.length });
  }
  if (overview.metadata) {
    pageSections.push({ id: 'metadata', label: 'Document Information' });
  }

  return pageSections;
}

/**
 * Loads and returns the structured game wiki overview data.
 * Reads from `structured-content/game-wiki-overview.json`.
 *
 * @throws {Error} If the file does not exist or fails to parse as valid JSON.
 * @returns {GameWikiData} The parsed encyclopedic overview data for Shadow Hearts.
 */
export function getGameWikiData(): GameWikiData {
  const filePath = path.resolve(process.cwd(), 'structured-content/game-wiki-overview.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Game wiki overview file not found at: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as GameWikiData;
}
