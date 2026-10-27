import { describe, expect, it } from 'vitest';
import {
  clamp,
  formatBytes,
  escapeHtml,
  kindForName,
  extensionOf,
  sum,
} from '@/utils';
import { evaluateExpression, FormulaError } from '@/utils/expression';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf, findByPath, HOME_PATH, pathOf } from '@/core/virtual-filesystem/fsUtils';
import { evaluateCell } from '@/apps/calc/calcEngine';
import { emptyAccounting, sampleAccounting, invoiceTotal, invoiceStatus, lineTotal, totals } from '@/apps/accounting/accountingStore';

describe('utilities', () => {
  it('formats sizes and clamps values', () => {
    expect(formatBytes(0)).toMatch(/0/);
    expect(formatBytes(2048)).toMatch(/KB|kB/i);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-4, 0, 10)).toBe(0);
  });

  it('escapes html injection in exports', () => {
    expect(escapeHtml('<b>"x"&</b>')).toBe('&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;');
  });

  it('maps file extensions to node kinds', () => {
    expect(kindForName('plan.novadoc')).toBe('document');
    expect(kindForName('budget.novasheet')).toBe('spreadsheet');
    expect(kindForName('talk.novadeck')).toBe('presentation');
    expect(kindForName('memo.novanote')).toBe('note');
    expect(kindForName('notes.txt')).toBe('text');
    expect(extensionOf('a/b/c.TXT')).toBe('txt');
  });

  it('sums numbers safely', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5);
    expect(sum([])).toBe(0);
  });
});

describe('formula engine', () => {
  const grid: Record<string, number> = { A1: 1, A2: 2, A3: 3, A4: 4, B1: 10 };
  const resolveCell = (ref: string) => {
    const key = ref.toUpperCase();
    if (!(key in grid)) throw new FormulaError('#REF');
    return grid[key];
  };
  const resolveRange = (from: string, to: string) => {
    if (from.toUpperCase() === 'A1' && to.toUpperCase() === 'A4') return [1, 2, 3, 4];
    throw new FormulaError('#REF');
  };

  it('evaluates arithmetic with precedence', () => {
    expect(evaluateExpression('2+3*4', { resolveCell, resolveRange })).toBe(14);
    expect(evaluateExpression('(2+3)*4', { resolveCell, resolveRange })).toBe(20);
    expect(evaluateExpression('10/4', { resolveCell, resolveRange })).toBe(2.5);
  });

  it('evaluates functions and ranges', () => {
    expect(evaluateExpression('SUM(A1:A4)', { resolveCell, resolveRange })).toBe(10);
    expect(evaluateExpression('AVERAGE(A1:A4)', { resolveCell, resolveRange })).toBe(2.5);
    expect(evaluateExpression('MAX(A1:A4)', { resolveCell, resolveRange })).toBe(4);
    expect(evaluateExpression('MIN(A1:A4)', { resolveCell, resolveRange })).toBe(1);
    expect(evaluateExpression('COUNT(A1:A4)', { resolveCell, resolveRange })).toBe(4);
    expect(evaluateExpression('SUM(A1:A4)*2+B1', { resolveCell, resolveRange })).toBe(30);
  });

  it('reports unsupported syntax instead of guessing', () => {
    expect(() => evaluateExpression('SUM(A1:A4', { resolveCell, resolveRange })).toThrow(FormulaError);
    expect(() => evaluateExpression('2+', { resolveCell, resolveRange })).toThrow(FormulaError);
    expect(() => evaluateExpression('SUM(C9:C12)', { resolveCell, resolveRange })).toThrow(FormulaError);
  });
});

describe('spreadsheet engine', () => {
  const sheet = (cells: Record<string, string>) =>
    ({
      name: 'Sheet1',
      cells: Object.fromEntries(Object.entries(cells).map(([ref, v]) => [ref, { v }])),
      colWidths: {},
      rowHeights: {},
    }) as never;

  it('computes arithmetic cells', () => {
    const result = evaluateCell(sheet({ A1: '2', A2: '3', A3: '=A1+A2*2' }), 'A3');
    expect(result.numeric).toBe(8);
    expect(result.error).toBeNull();
  });

  it('supports SUM over a range', () => {
    const result = evaluateCell(sheet({ A1: '2', A2: '3', A3: '4', A4: '=SUM(A1:A3)' }), 'A4');
    expect(result.numeric).toBe(9);
  });

  it('flags circular references and unknown functions as errors', () => {
    const circular = evaluateCell(sheet({ A1: '=A1' }), 'A1');
    expect(circular.error).toBeTruthy();
    const unknown = evaluateCell(sheet({ A1: '=NOPE(1)' }), 'A1');
    expect(unknown.error).toBeTruthy();
  });
});

describe('virtual file system', () => {
  it('seeds the home tree with the expected folders', async () => {
    await useFiles.getState().init();
    const nodes = useFiles.getState().nodes;
    expect(pathOf(nodes, FOLDER_IDS.home)).toBe('/home');
    expect(HOME_PATH).toBe('/home/demo');
    expect(findByPath(nodes, HOME_PATH)).toBeTruthy();
    for (const folder of ['Documents', 'Downloads', 'Pictures', 'Music', 'Videos']) {
      expect(findByPath(nodes, `${HOME_PATH}/${folder}`)).toBeTruthy();
    }
  });

  it('creates, renames, moves and trashes files', async () => {
    await useFiles.getState().init();
    const docs = findByPath(useFiles.getState().nodes, `${HOME_PATH}/Documents`)!;
    const created = useFiles.getState().createFile(docs.id, 'Test Note.txt', { content: 'hello' });
    expect(created).toBeTruthy();
    expect(created!.kind).toBe('text');

    expect(useFiles.getState().renameNode(created!.id, 'Renamed.txt')).toBe(true);
    expect(useFiles.getState().nodes[created!.id].name).toBe('Renamed.txt');

    expect(useFiles.getState().renameNode(created!.id, '')).toBe(false);

    expect(useFiles.getState().trashNode(created!.id)).toBe(true);
    expect(useFiles.getState().nodes[created!.id].trashed).toBe(true);

    expect(useFiles.getState().restoreNode(created!.id)).toBe(true);
    expect(useFiles.getState().nodes[created!.id].trashed).toBe(false);

    useFiles.getState().trashNode(created!.id);
    useFiles.getState().deleteForever(created!.id);
    expect(useFiles.getState().nodes[created!.id]).toBeUndefined();
  });

  it('refuses to trash system folders', async () => {
    await useFiles.getState().init();
    expect(useFiles.getState().trashNode(FOLDER_IDS.home)).toBe(false);
  });

  it('writes documents at a path and reads them back', async () => {
    await useFiles.getState().init();
    const file = useFiles.getState().writeFileAtPath(`${HOME_PATH}/Documents/report.novadoc`, '<p>hi</p>', 'document');
    expect(file).toBeTruthy();
    expect(file!.content).toBe('<p>hi</p>');
    expect(file!.kind).toBe('document');
  });

  it('keeps names unique inside a folder', async () => {
    await useFiles.getState().init();
    const docs = findByPath(useFiles.getState().nodes, `${HOME_PATH}/Documents`)!;
    const first = useFiles.getState().createFile(docs.id, 'Dup.txt', { content: '' })!;
    const second = useFiles.getState().createFile(docs.id, 'Dup.txt', { content: '' })!;
    expect(second.id).not.toBe(first.id);
    expect(second.name).not.toBe(first.name);
    const names = childrenOf(useFiles.getState().nodes, docs.id).map((node) => node.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('accounting math', () => {
  const data = sampleAccounting();

  it('has seeded sample data flagged as sample', () => {
    expect(data.settings.sampleData).toBe(true);
    expect(data.invoices.length).toBeGreaterThan(0);
    expect(data.parties.customers.length).toBeGreaterThan(0);
    expect(data.parties.suppliers.length).toBeGreaterThan(0);
  });

  it('computes line, invoice and status totals', () => {
    const line = { id: 'l1', description: 'x', qty: 2, price: 1000, discount: 100 } as never;
    expect(lineTotal(line)).toBe(1900);

    const invoice = data.invoices[0];
    const total = invoiceTotal(invoice);
    expect(total).toBeGreaterThan(0);
    const status = invoiceStatus(invoice);
    expect(['paid', 'partial', 'unpaid']).toContain(status);
    expect(invoiceStatus({ ...invoice, paid: total })).toBe('paid');
    expect(invoiceStatus({ ...invoice, paid: total / 2 })).toBe('partial');
    expect(invoiceStatus({ ...invoice, paid: 0 })).toBe('unpaid');
  });

  it('derives dashboard totals from the same data', () => {
    const summary = totals(data);
    expect(summary.salesTotal).toBeGreaterThan(0);
    expect(summary.receivables).toBeGreaterThanOrEqual(0);
    expect(summary.receivables).toBeLessThanOrEqual(summary.salesTotal);
    expect(Number.isFinite(summary.balance)).toBe(true);
  });

  it('starts empty when asked for an empty workspace', () => {
    const empty = emptyAccounting();
    expect(empty.invoices).toHaveLength(0);
    expect(empty.parties.customers).toHaveLength(0);
    expect(empty.settings.sampleData).toBe(false);
  });
});
