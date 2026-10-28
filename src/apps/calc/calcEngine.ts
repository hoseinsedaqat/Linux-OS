import type { Sheet, SheetCell, Workbook } from '@/types/documents';
import { evaluateExpression, expandRange, FormulaError } from '@/utils/expression';
import { uid } from '@/utils';

export const ROWS = 40;
export const COLS = 16;

export function emptySheet(name: string): Sheet {
  return { id: uid('sheet'), name, cells: {}, colWidths: {}, rowHeights: {} };
}

export function emptyWorkbook(): Workbook {
  const sheet = emptySheet('Sheet 1');
  return { title: 'Untitled Spreadsheet', sheets: [sheet], activeSheet: sheet.id };
}

export interface CellEvaluation {
  display: string;
  numeric: number | null;
  error: string | null;
  raw: string;
}

const seenStack: string[] = [];

export function evaluateCell(sheet: Sheet, ref: string): CellEvaluation {
  const cell = sheet.cells[ref];
  if (!cell || cell.v === undefined || cell.v === '') {
    return { display: '', numeric: null, error: null, raw: '' };
  }
  const raw = cell.v;
  if (!raw.startsWith('=')) {
    const numeric = Number(raw.replace(/,/g, ''));
    const isNumeric = raw.trim() !== '' && Number.isFinite(numeric);
    return {
      display: formatValue(isNumeric ? numeric : raw, isNumeric, cell),
      numeric: isNumeric ? numeric : null,
      error: null,
      raw,
    };
  }

  if (seenStack.includes(ref)) {
    return { display: '#CYCLE', numeric: null, error: 'Circular reference', raw };
  }
  seenStack.push(ref);
  try {
    const result = evaluateExpression(raw, {
      resolveCell: (target) => {
        if (seenStack.includes(target)) throw new FormulaError('Circular reference');
        const evaluation = evaluateCell(sheet, target);
        if (evaluation.numeric === null) {
          if (evaluation.error) throw new FormulaError(evaluation.error);
          return Number.NaN;
        }
        return evaluation.numeric;
      },
      resolveRange: (from, to) =>
        expandRange(from, to).map((target) => {
          const evaluation = evaluateCell(sheet, target);
          return evaluation.numeric ?? Number.NaN;
        }),
    });
    return { display: formatValue(result, true, cell), numeric: result, error: null, raw };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid formula';
    return { display: '#ERROR', numeric: null, error: message, raw };
  } finally {
    seenStack.pop();
  }
}

export function formatValue(value: string | number, numeric: boolean, cell: SheetCell): string {
  if (!numeric) return String(value);
  const number = Number(value);
  if (cell.format === 'percent') return `${(number * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  if (cell.format === 'currency') {
    return number.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }
  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function toCsv(sheet: Sheet, maxRow: number, maxCol: number): string {
  const lines: string[] = [];
  for (let row = 0; row < maxRow; row += 1) {
    const values: string[] = [];
    for (let col = 0; col < maxCol; col += 1) {
      const ref = `${columnName(col)}${row + 1}`;
      const evaluation = evaluateCell(sheet, ref);
      const value = evaluation.error ? evaluation.display : (evaluation.numeric ?? evaluation.raw ?? '');
      values.push(/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));
    }
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

export function columnName(index: number): string {
  let label = '';
  let value = index;
  while (value >= 0) {
    label = String.fromCharCode((value % 26) + 65) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

export function shiftCells(
  cells: Record<string, SheetCell>,
  axis: 'row' | 'col',
  index: number,
  delta: 1 | -1,
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  Object.entries(cells).forEach(([ref, cell]) => {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match) return;
    const col = columnNameToIndex(match[1]);
    const row = Number(match[2]) - 1;
    if (axis === 'row' && row >= index) {
      const newRow = row + delta;
      if (newRow < 0) return;
      next[`${columnName(col)}${newRow + 1}`] = cell;
    } else if (axis === 'col' && col >= index) {
      const newCol = col + delta;
      if (newCol < 0) return;
      next[`${columnName(newCol)}${row + 1}`] = cell;
    } else {
      next[ref] = cell;
    }
  });
  return next;
}

function columnNameToIndex(label: string): number {
  let index = 0;
  for (const char of label) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}
