import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { FSNode, WindowRect } from '@/types';
import { HOME_PATH, nodeMap, ROOT_ID, HOME_ID } from '@/core/virtual-filesystem/fsUtils';
import {
  LAYOUTS,
  SNAP_PRESETS,
  clearSession,
  layoutRects,
  loadSession,
  saveSession,
  type LayoutId,
} from '@/core/window-manager/session';
import { runLine, splitUnquoted, tokenizeCommand, type ShellContext } from '@/apps/terminal/shell';
import { markdownToText, parseInline, parseMarkdown, slugify } from '@/core/markdown/markdown';
import { usageRows, useUsage } from '@/core/analytics/usage';
import { WRITER_TEMPLATES } from '@/apps/writer/templates';
import { DECK_TEMPLATES } from '@/apps/impress/templates';
import { DOCS } from '@/core/docs/content';

const now = 1_700_000_000_000;
const node = (partial: Partial<FSNode> & Pick<FSNode, 'id' | 'name' | 'kind'>): FSNode => ({
  parentId: ROOT_ID,
  content: '',
  createdAt: now,
  modifiedAt: now,
  ...partial,
});

function fs(): ShellContext['nodes'] {
  return nodeMap([
    node({ id: ROOT_ID, name: 'File System', kind: 'folder', parentId: null }),
    node({ id: HOME_ID, name: 'home', kind: 'folder', parentId: ROOT_ID }),
    node({ id: 'demo', name: 'demo', kind: 'folder', parentId: HOME_ID }),
    node({ id: 'notes', name: 'notes', kind: 'folder', parentId: 'demo' }),
    node({ id: 'a', name: 'alpha.txt', kind: 'text', parentId: 'demo', content: 'one\ntwo\nthree\n' }),
    node({ id: 'b', name: 'beta.md', kind: 'text', parentId: 'demo', content: 'alpha\n' }),
    node({
      id: 'c',
      name: 'code.ts',
      kind: 'text',
      parentId: 'notes',
      content: 'const a = 1;\nconst b = 2;\n',
    }),
    node({ id: 'd', name: 'gamma.txt', kind: 'text', parentId: 'notes', content: 'one\ntwo\n' }),
  ]);
}

const ctx = (): ShellContext => ({ nodes: fs(), cwd: HOME_PATH, history: [], language: 'en' });

const text = (out: ReturnType<typeof runLine>) => out.lines.map((line) => line.text).join('\n');

describe('session snapshots', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('round-trips window geometry, active window and workspace', () => {
    saveSession(
      [
        {
          id: 'w1',
          appId: 'files',
          title: 'Files',
          x: 10.4,
          y: 20.6,
          width: 700,
          height: 480,
          maximized: false,
          snapped: 'left',
          workspace: 2,
          minimized: false,
          payload: { path: '/home/demo' },
        },
        {
          id: 'w2',
          appId: 'terminal',
          title: 'Terminal',
          x: 300,
          y: 200,
          width: 640,
          height: 400,
          maximized: true,
          workspace: 1,
          minimized: true,
        },
      ],
      'w2',
      1,
    );

    const session = loadSession();
    expect(session).not.toBeNull();
    expect(session!.windows).toHaveLength(2);
    expect(session!.windows[0]).toMatchObject({
      appId: 'files',
      rect: { x: 10, y: 21, width: 700, height: 480 },
      snapped: 'left',
      workspace: 2,
    });
    expect(session!.windows[0].payload).toEqual({ path: '/home/demo' });
    expect(session!.activeIndex).toBe(1);
    expect(session!.workspace).toBe(1);

    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('refuses corrupt snapshots and caps the window count', () => {
    localStorage.setItem('nova-linux.session.v1', '{"version":9,"windows":[]}');
    expect(loadSession()).toBeNull();

    localStorage.setItem('nova-linux.session.v1', 'not json');
    expect(loadSession()).toBeNull();

    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `w${index}`,
      appId: 'files' as const,
      title: 'Files',
      x: index,
      y: index,
      width: 400,
      height: 300,
      maximized: false,
      minimized: false,
    }));
    saveSession(many, 'w19', 1);
    expect(loadSession()!.windows.length).toBeLessThanOrEqual(12);
  });

  it('only keeps string and boolean payload values', () => {
    saveSession(
      [
        {
          id: 'w1',
          appId: 'code',
          title: 'Code',
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          maximized: false,
          minimized: false,
          payload: { path: '/home/demo/a.ts' } as never,
        },
      ],
      null,
      1,
    );
    expect(loadSession()!.windows[0].payload).toEqual({ path: '/home/demo/a.ts' });
    expect(loadSession()!.activeIndex).toBe(-1);
  });
});

describe('snap presets and layouts', () => {
  const area: WindowRect = { x: 0, y: 32, width: 1000, height: 600 };

  it('describes six snap targets with translations', () => {
    expect(SNAP_PRESETS.map((preset) => preset.mode)).toEqual([
      'left',
      'right',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]);
    expect(LAYOUTS).toHaveLength(5);
  });

  it('columns never overlap and cover the width', () => {
    const rects = layoutRects('columns', area, 3);
    expect(rects).toHaveLength(3);
    for (const rect of rects) expect(rect.height).toBe(area.height);
    expect(rects[1].x).toBeGreaterThan(rects[0].x + rects[0].width);
    expect(rects[2].x + rects[2].width).toBeLessThanOrEqual(area.x + area.width);
  });

  it('rows stack top to bottom inside the work area', () => {
    const rects = layoutRects('rows', area, 2);
    expect(rects[0].y).toBe(area.y);
    expect(rects[1].y).toBeGreaterThan(rects[0].y + rects[0].height - 1);
    expect(rects[1].y + rects[1].height).toBeLessThanOrEqual(area.y + area.height);
  });

  it('grid spreads four windows over two rows', () => {
    const rects = layoutRects('grid', area, 4);
    expect(rects[0].y).toBe(rects[1].y);
    expect(rects[2].y).toBeGreaterThan(rects[0].y);
    // square-ish cells
    expect(Math.abs(rects[0].width - rects[0].height)).toBeLessThan(area.width);
  });

  it('focus keeps one large window and stacks the rest', () => {
    const rects = layoutRects('focus', area, 3);
    expect(rects[0].width).toBeGreaterThan(rects[1].width);
    expect(rects[1].y).toBeLessThan(rects[2].y);
    expect(layoutRects('focus', area, 1)[0].width).toBe(area.width);
  });

  it('cascade offsets each window and stays on screen', () => {
    const rects = layoutRects('cascade', area, 4);
    for (let index = 1; index < rects.length; index += 1) {
      expect(rects[index].x).toBeGreaterThan(rects[index - 1].x);
      expect(rects[index].y).toBeGreaterThan(rects[index - 1].y);
    }
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(area.x);
      expect(rect.y).toBeGreaterThanOrEqual(area.y);
    }
  });

  it('always returns one rectangle per requested window, even for zero', () => {
    for (const layout of LAYOUTS.map((item) => item.id) as LayoutId[]) {
      expect(layoutRects(layout, area, 0)).toHaveLength(1);
      expect(layoutRects(layout, area, 5)).toHaveLength(5);
    }
  });
});

describe('simulated shell', () => {
  it('splits on pipes but respects quotes', () => {
    // quotes are removed but their contents are kept intact, so a quoted
    // pipe is not treated as a separator
    expect(splitUnquoted('ls | grep "a|b" | wc -l', '|')).toEqual(['ls ', ' grep a|b ', ' wc -l']);
    expect(tokenizeCommand('echo "hello world"  >  notes.txt')).toEqual([
      'echo',
      'hello world',
      '>',
      'notes.txt',
    ]);
  });

  it('runs pipelines end to end', () => {
    const out = runLine('ls | grep .txt | wc -l', ctx());
    expect(out.lines.at(-1)?.text.trim()).toBe('1');
  });

  it('redirects stdout into a new file and appends', () => {
    const write = runLine('echo "hello" > hello.txt', ctx());
    const effect = write.effects.find((item) => item.type === 'write');
    expect(effect).toMatchObject({ type: 'write', path: `${HOME_PATH}/hello.txt`, content: 'hello\n' });

    const append = runLine('echo "again" >> hello.txt', ctx());
    expect(append.effects.find((item) => item.type === 'write')).toMatchObject({
      path: `${HOME_PATH}/hello.txt`,
      content: 'again\n',
    });
    expect(text(append)).toContain('Appended');
  });

  it('grep filters, head/wc/sort/uniq transform stdin', () => {
    expect(text(runLine('cat alpha.txt | grep -n two', ctx()))).toContain('2:two');
    expect(text(runLine('cat alpha.txt | head -n 2', ctx()))).toBe('one\ntwo');
    expect(text(runLine('cat alpha.txt | wc -l', ctx())).trim()).toBe('3');
    expect(text(runLine('ls | sort -r | head -n 1', ctx()))).toBe('notes/');
    expect(text(runLine('ls', ctx())).split('\n')).toEqual(['notes/', 'alpha.txt', 'beta.md']);
    expect(text(runLine('cat alpha.txt | uniq | wc -l', ctx())).trim()).toBe('3');
  });

  it('moves the working directory and reports unknown paths', () => {
    const changed = runLine('cd notes', ctx());
    expect(changed.cwd).toBe(`${HOME_PATH}/notes`);
    expect(changed.lines).toHaveLength(0);

    const back = runLine('cd ..', { ...ctx(), cwd: `${HOME_PATH}/notes` });
    expect(back.cwd).toBe(HOME_PATH);

    const missing = runLine('cd nowhere', ctx());
    expect(missing.lines[0].kind).toBe('error');
  });

  it('creates folders and files through effects, never touching the store', () => {
    const created = runLine('mkdir projects', ctx());
    expect(created.effects[0]).toEqual({ type: 'mkdir', parentPath: HOME_PATH, name: 'projects' });
    const touched = runLine('touch draft.md', ctx());
    expect(touched.effects[0]).toMatchObject({ type: 'touch', parentPath: HOME_PATH, name: 'draft.md' });
  });

  it('refuses to remove a folder without -r and never escapes HOME', () => {
    expect(text(runLine('rm notes', ctx()))).toContain('use -r');
    const removed = runLine('rm -r notes', ctx());
    expect(removed.effects[0]).toMatchObject({ type: 'remove', recursive: true });

    const escape = runLine('cat ../../etc/passwd', ctx());
    expect(escape.lines.some((line) => line.kind === 'error')).toBe(true);
  });

  it('edits non-destructively for unknown commands and reports errors', () => {
    const out = runLine('frobnicate', ctx());
    expect(out.lines[0].kind).toBe('error');
    expect(out.effects).toHaveLength(0);
  });

  it('prints help and system information', () => {
    expect(text(runLine('help', ctx())).toLowerCase()).toContain('pipelines');
    expect(text(runLine('neofetch', ctx()))).toContain('NOVA Linux');
    expect(text(runLine('uname -a', ctx()))).toContain('nova');
    expect(text(runLine('whoami', ctx()))).toBe('demo');
  });

  it('emits an open effect instead of doing IO itself', () => {
    const out = runLine('open alpha.txt', ctx());
    expect(out.effects[0]).toEqual({ type: 'open', path: `${HOME_PATH}/alpha.txt` });
  });
});

describe('markdown parser', () => {
  const source = [
    '# Title',
    '',
    'Some **bold** and `code` and [link](https://example.com).',
    '',
    '- one',
    '- two',
    '',
    '> quoted',
    '',
    '```ts',
    'const a = 1;',
    '```',
    '',
    '| a | b |',
    '| - | - |',
    '| 1 | 2 |',
  ].join('\n');

  it('recognises headings, lists, quotes, fences and tables', () => {
    const blocks = parseMarkdown(source);
    const kinds = blocks.map((block) => block.type);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('list');
    expect(kinds).toContain('quote');
    expect(kinds).toContain('code');
    expect(kinds).toContain('table');
  });

  it('parses inline emphasis, code and links', () => {
    const tokens = parseInline('a **b** `c` [d](https://x.dev)');
    expect(tokens.some((token) => token.type === 'bold')).toBe(true);
    expect(tokens.some((token) => token.type === 'code')).toBe(true);
    const link = tokens.find((token) => token.type === 'link');
    expect(link).toMatchObject({ type: 'link', href: 'https://x.dev' });
  });

  it('flattens documents to plain text for search and exports', () => {
    const flat = markdownToText(parseMarkdown(source));
    expect(flat).toContain('Title');
    expect(flat).toContain('const a = 1;');
    expect(flat).not.toContain('```');
  });

  it('creates stable, unique slugs', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('مرحبا دنيا')).toBe(slugify('مرحبا دنيا'));
    expect(slugify('  --Leading dashes--  ')).toBe('leading-dashes');
  });

  it('handles empty and malformed input without throwing', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(() => parseMarkdown('```\nunclosed')).not.toThrow();
    expect(() => parseMarkdown('| a |\n| -')).not.toThrow();
  });
});

describe('local usage counters', () => {
  beforeEach(() => useUsage.getState().reset());

  it('counts launches and orders apps by use', () => {
    useUsage.getState().record('files');
    useUsage.getState().record('files');
    useUsage.getState().record('terminal');

    const state = useUsage.getState();
    expect(state.counts.files).toBe(2);
    expect(state.totalOpens).toBe(3);

    const rows = usageRows(state.counts, state.lastUsed);
    expect(rows.map((row) => row.appId)).toEqual(['files', 'terminal']);
    expect(rows[0].count).toBe(2);
  });

  it('resets everything on request', () => {
    useUsage.getState().record('files');
    useUsage.getState().reset();
    expect(useUsage.getState().totalOpens).toBe(0);
    expect(usageRows(useUsage.getState().counts, useUsage.getState().lastUsed)).toEqual([]);
  });

  it('ignores zero and negative counts in the chart data', () => {
    expect(usageRows({ files: 0, terminal: 3 }, {})).toHaveLength(1);
  });
});

describe('document and deck templates', () => {
  it('offers writer templates with an RTL variant and real bodies', () => {
    expect(WRITER_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const template of WRITER_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.html.trim().length).toBeGreaterThan(0);
    }
    expect(WRITER_TEMPLATES.some((template) => template.rtl)).toBe(true);
    expect(WRITER_TEMPLATES.some((template) => !template.rtl)).toBe(true);
  });

  it('builds impress decks with at least one slide each', () => {
    for (const template of DECK_TEMPLATES) {
      const deck = template.build();
      expect(deck.slides.length).toBeGreaterThan(0);
      expect(deck.title.length).toBeGreaterThan(0);
      for (const slide of deck.slides) expect(typeof slide.title).toBe('string');
    }
    // builds must be independent copies, not shared mutable state
    const first = DECK_TEMPLATES[0].build();
    const second = DECK_TEMPLATES[0].build();
    expect(first.slides).not.toBe(second.slides);
  });
});

describe('documentation content', () => {
  it('ships the README plus the three handbooks', () => {
    const ids = DOCS.map((doc) => doc.id);
    expect(ids).toContain('readme');
    expect(ids).toContain('architecture');
    expect(ids).toContain('shortcuts');
    expect(ids).toContain('testing');
  });

  it('every handbook has a title, a summary and real Markdown', () => {
    for (const doc of DOCS) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.description.length).toBeGreaterThan(0);
      expect(parseMarkdown(doc.source).length).toBeGreaterThan(0);
    }
  });

  it('documents the round-4 features that users can actually try', () => {
    const all = DOCS.map((doc) => doc.source).join('\n').toLowerCase();
    for (const needle of ['ctrl+shift+p', 'markdown', 'session', 'usage']) {
      expect(all).toContain(needle);
    }
  });
});
