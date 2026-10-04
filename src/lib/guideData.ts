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

export function getTocData(): TocData {
  const filePath = path.join(SECTIONS_DIR, 'i-1-00-table-of-contents.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: TocData = JSON.parse(raw);

  // Cross-reference existing files in structured-content/sections
  const files = fs.readdirSync(SECTIONS_DIR);

  data.guide.overview.sections.forEach((cat) => {
    cat.entries.forEach((entry) => {
      // Find matching structured file by code or id prefix
      const match = files.find((f) => {
        const lower = f.toLowerCase();
        // check code in file name (e.g. w-1-01)
        const cleanCode = entry.code.toLowerCase().replace(/\[|\]/g, '');
        return lower.startsWith(cleanCode);
      });

      if (match) {
        entry.has_structured = true;
        // e.g. w-1-01-trans-siberian-express.json -> w-1-01
        const cleanCode = entry.code.toLowerCase().replace(/\[|\]/g, '');
        entry.id = cleanCode;
      } else {
        const cleanCode = entry.code.toLowerCase().replace(/\[|\]/g, '');
        entry.id = cleanCode;
        entry.has_structured = false;
      }
    });
  });

  return data;
}

export function getAllStructuredSections(): Array<{ id: string; filename: string; data: any }> {
  if (!fs.existsSync(SECTIONS_DIR)) return [];
  const files = fs.readdirSync(SECTIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(filename => {
    const filePath = path.join(SECTIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const id = data.guide?.id || filename.replace('.json', '');
    return { id, filename, data };
  });
}
