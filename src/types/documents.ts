/** Document models shared by the office apps and the seed file system. */

export interface WriterDoc {
  title: string;
  html: string;
  pageSize?: 'a4' | 'letter';
  rtl?: boolean;
}

export type CellAlign = 'left' | 'center' | 'right';

export interface SheetCell {
  /** Raw value (what the user typed). */
  v: string;
  /** Optional number format. */
  format?: 'text' | 'number' | 'currency' | 'percent';
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bg?: string;
  align?: CellAlign;
}

export interface Sheet {
  id: string;
  name: string;
  cells: Record<string, SheetCell>;
  colWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface Workbook {
  title: string;
  sheets: Sheet[];
  activeSheet: string;
}

export type SlideLayout = 'title' | 'title-body' | 'bullets' | 'two-column' | 'blank';

export interface SlideModel {
  id: string;
  layout: SlideLayout;
  title: string;
  body: string;
  bg?: string;
  /** Extra text box content for two-column layouts. */
  second?: string;
}

export interface DeckModel {
  title: string;
  theme: 'midnight' | 'mint' | 'sunset' | 'paper' | 'ocean';
  slides: SlideModel[];
}
