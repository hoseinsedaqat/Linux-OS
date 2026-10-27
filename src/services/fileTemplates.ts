import type { FSNodeKind } from '@/types';
import type { DeckModel, Workbook, WriterDoc } from '@/types/documents';
import { uid } from '@/utils';

export interface TemplateFile {
  name: string;
  kind: FSNodeKind;
  content: string;
  meta?: Record<string, unknown>;
}

export function emptyWorkbook(): Workbook {
  return {
    title: 'Untitled Spreadsheet',
    activeSheet: 'sheet-1',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet 1',
        cells: {},
        colWidths: {},
        rowHeights: {},
      },
    ],
  };
}

export function emptyDeck(): DeckModel {
  return {
    title: 'Untitled Presentation',
    theme: 'midnight',
    slides: [
      { id: uid('slide'), layout: 'title', title: 'Untitled Presentation', body: 'Add a subtitle' },
    ],
  };
}

export function emptyDocument(): WriterDoc {
  return { title: 'Untitled Document', html: '<p><br></p>' };
}

export function templateFor(kind: 'document' | 'spreadsheet' | 'presentation' | 'note' | 'text'): TemplateFile {
  switch (kind) {
    case 'document':
      return { name: 'Untitled Document.novadoc', kind: 'document', content: JSON.stringify(emptyDocument()) };
    case 'spreadsheet':
      return { name: 'Untitled Spreadsheet.novasheet', kind: 'spreadsheet', content: JSON.stringify(emptyWorkbook()) };
    case 'presentation':
      return { name: 'Untitled Presentation.novadeck', kind: 'presentation', content: JSON.stringify(emptyDeck()) };
    case 'note':
      return { name: 'Untitled Note.novanote', kind: 'note', content: '', meta: { color: 'mint' } };
    default:
      return { name: 'New Text File.txt', kind: 'text', content: '' };
  }
}
