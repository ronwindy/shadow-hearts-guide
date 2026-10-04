import fs from 'node:fs';
import path from 'node:path';

export interface GuideMetadata {
  game: string;
  author: string;
  contact_email?: string;
  facebook?: string;
  region?: string;
  type?: string;
  platform?: string;
  version?: string;
  last_updated?: string;
  best_viewing_program?: string;
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
    callouts?: Array<{
      type: string;
      title: string;
      text: string;
    }>;
  };
}

export interface TocEntry {
  code: string;
  title: string;
  is_sidequest: boolean;
  id?: string;
  has_structured?: boolean;
  label?: string;
}

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
      legend: string;
    };
  };
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
        entry.has_structured = false;
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
  const files = fs.readdirSync(SECTIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(filename => {
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
