/**
 * Code editor helpers: language detection, a tiny tokenizer and cursor maths.
 *
 * The tokenizer is intentionally small and dependency-free. It never emits HTML
 * (the UI renders spans), so file content can never inject markup.
 */

export type Language = 'ts' | 'js' | 'json' | 'css' | 'html' | 'md' | 'py' | 'sh' | 'text';

export interface Token {
  text: string;
  type: 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'function' | 'tag' | 'property';
}

const EXTENSION_LANGUAGE: Record<string, Language> = {
  ts: 'ts',
  tsx: 'ts',
  js: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  json: 'json',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  svg: 'html',
  md: 'md',
  markdown: 'md',
  py: 'py',
  sh: 'sh',
  bash: 'sh',
  txt: 'text',
  log: 'text',
};

export function detectLanguage(name: string): Language {
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  return EXTENSION_LANGUAGE[extension] ?? 'text';
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  ts: 'TypeScript',
  js: 'JavaScript',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  md: 'Markdown',
  py: 'Python',
  sh: 'Shell',
  text: 'Plain Text',
};

const KEYWORDS: Record<Language, string[]> = {
  ts: ['import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'interface', 'type', 'class', 'extends', 'implements', 'new', 'await', 'async', 'try', 'catch', 'finally', 'throw', 'typeof', 'as', 'default', 'switch', 'case', 'break', 'continue', 'this', 'null', 'undefined', 'true', 'false', 'void', 'enum', 'readonly', 'public', 'private', 'static'],
  js: ['import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'await', 'async', 'try', 'catch', 'finally', 'throw', 'typeof', 'default', 'switch', 'case', 'break', 'continue', 'this', 'null', 'undefined', 'true', 'false'],
  json: ['true', 'false', 'null'],
  css: ['important', 'media', 'supports', 'keyframes', 'root'],
  html: ['html', 'head', 'body', 'div', 'span', 'script', 'link', 'meta', 'style', 'button', 'section'],
  md: [],
  py: ['import', 'from', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'with', 'as', 'try', 'except', 'finally', 'raise', 'lambda', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is'],
  sh: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'case', 'esac', 'export', 'echo', 'cd', 'function', 'return'],
  text: [],
};

/** One combined pass keeps highlighting cheap even for large files. */
const COMBINED: Partial<Record<Language, RegExp>> = {
  ts: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g,
  js: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g,
  json: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(-?\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g,
  css: /(\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(--[\w-]+|#[0-9a-fA-F]{3,8})|\b(\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg)?)\b/g,
  html: /(<!--[\s\S]*?-->)|(<\/?[\w-]+)|("[^"]*")|\b([\w-]+)=/g,
  md: /(^#{1,6} [^\n]*|`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]*\]\([^)\n]*\))/gm,
  py: /(#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][\w]*)\b/g,
  sh: /(#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(\d+)\b|\b([A-Za-z_][\w-]*)\b/g,
};

const TYPE_BY_GROUP: Partial<Record<Language, Token['type'][]>> = {
  ts: ['comment', 'string', 'number', 'keyword'],
  js: ['comment', 'string', 'number', 'keyword'],
  json: ['string', 'number', 'keyword'],
  css: ['comment', 'string', 'property', 'number'],
  html: ['comment', 'tag', 'string', 'property'],
  md: ['keyword', 'keyword', 'string'],
  py: ['comment', 'string', 'number', 'keyword'],
  sh: ['comment', 'string', 'number', 'keyword'],
};

/** Split source into coloured tokens. Unknown languages stay plain. */
export function tokenize(source: string, language: Language): Token[] {
  const pattern = COMBINED[language];
  if (!pattern) return source ? [{ text: source, type: 'plain' }] : [];

  const keywords = new Set(KEYWORDS[language] ?? []);
  const groups = TYPE_BY_GROUP[language] ?? [];
  const tokens: Token[] = [];
  let lastIndex = 0;
  pattern.lastIndex = 0;

  for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
    if (match.index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, match.index), type: 'plain' });
    }
    const groupIndex = match.slice(1).findIndex((value) => value !== undefined);
    const raw = match[0];
    let type: Token['type'] = groupIndex >= 0 ? groups[groupIndex] ?? 'plain' : 'plain';

    if (type === 'keyword') {
      const previous = source.slice(0, match.index).trimEnd().slice(-1);
      const memberAccess = previous === '.' || previous === '?' && source.slice(0, match.index).trimEnd().slice(-2) === '?.';
      if (!keywords.has(raw) || memberAccess) {
        const rest = source.slice(match.index + raw.length).trimStart();
        type = rest.startsWith('(') && !memberAccess ? 'function' : 'plain';
      }
    }

    tokens.push({ text: raw, type });
    lastIndex = match.index + raw.length;
    if (raw.length === 0) pattern.lastIndex += 1;
  }

  if (lastIndex < source.length) tokens.push({ text: source.slice(lastIndex), type: 'plain' });
  return tokens;
}

/** 1-based line/column for a caret offset. */
export function caretPosition(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const lines = before.split('\n');
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function lineCount(source: string): number {
  return source === '' ? 1 : source.split('\n').length;
}

export interface SearchHit {
  line: number;
  column: number;
  preview: string;
}

/** Case-insensitive in-file search for the editor's find box. */
export function findInFile(source: string, term: string, limit = 200): SearchHit[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  source.split('\n').forEach((line, index) => {
    const at = line.toLowerCase().indexOf(needle);
    if (at === -1) return;
    hits.push({ line: index + 1, column: at + 1, preview: line.trim().slice(0, 120) });
    if (hits.length >= limit) return;
  });
  return hits.slice(0, limit);
}

/** Indent or un-indent the selected lines with two spaces. */
export function indentSelection(
  source: string,
  start: number,
  end: number,
  dedent = false,
): { value: string; start: number; end: number } {
  const from = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = source.indexOf('\n', end);
  const to = nextBreak === -1 ? source.length : nextBreak;
  const block = source.slice(from, to);
  const lines = block.split('\n');
  const changed = lines.map((line) =>
    dedent ? line.replace(/^ {1,2}/, '') : line.length > 0 || lines.length === 1 ? `  ${line}` : line,
  );
  const next = changed.join('\n');
  return {
    value: source.slice(0, from) + next + source.slice(to),
    start: from,
    end: from + next.length,
  };
}

export const STARTER_FILES: Record<string, string> = {
  'hello.ts': `// Welcome to NOVA Code — a small, real editor.
// Everything you save here lands in ~/Projects in the virtual file system.

interface Greeting {
  name: string;
  language: 'en' | 'fa';
}

export function greet({ name, language }: Greeting): string {
  const table = { en: 'Hello', fa: 'سلام' };
  return \`\${table[language]}, \${name}!\`;
}

console.log(greet({ name: 'NOVA', language: 'fa' }));
`,
  'theme.css': `:root {
  --accent: #3ce3a4;
  --surface-1: #0d121c;
  --radius-lg: 18px;
}

.panel {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-1) 92%, transparent);
}
`,
  'notes.md': `# Project notes

- [x] Boot sequence
- [x] Window manager
- [ ] Ship the editor

> Tip: press Ctrl + S to save, and Ctrl + F to search inside the file.
`,
  'data.json': `{
  "name": "nova-linux",
  "version": "1.0.0",
  "apps": 23,
  "offline": true
}
`,
};

/** Folders that can be opened as an editor root (relative to the home folder). */
export const CODE_ROOTS: Array<{ path: string; label: string }> = [
  { path: '~/Projects', label: 'Projects' },
  { path: '~/Documents', label: 'Documents' },
  { path: '~/Desktop', label: 'Desktop' },
  { path: '~/Notes', label: 'Notes' },
];

/**
 * Format a document: pretty-print JSON, otherwise trim trailing whitespace,
 * collapse runs of blank lines and re-indent brace-style code by its own
 * indentation unit. Not a full language parser — the status bar says so.
 */
export function formatDocument(source: string, language: Language): string {
  const trimmed = source.replace(/\r\n?/g, '\n').replace(/\s+$/, '');

  if (language === 'json') {
    try {
      return `${JSON.stringify(JSON.parse(trimmed), null, 2)}\n`;
    } catch {
      // Invalid JSON is left alone: formatting must never silently corrupt it.
    }
  }

  const cleanLines = trimmed
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line, index, all) => !(line.trim() === '' && all[index - 1]?.trim() === ''));

  if (language === 'md' || language === 'text' || language === 'sh') {
    return `${cleanLines.join('\n')}\n`;
  }

  const indentUnit = (() => {
    const match = /^( +)\S/m.exec(trimmed);
    if (match) return match[1];
    const tabbed = /^\t\S/m.test(trimmed);
    return tabbed ? '\t' : '  ';
  })();

  let depth = 0;
  const formatted = cleanLines.map((line) => {
    const text = line.trim();
    if (!text) return '';
    const closesFirst = /^(\}|\]|\)|else\b|catch\b|finally\b)/.test(text);
    if (closesFirst) depth = Math.max(0, depth - 1);
    const result = `${indentUnit.repeat(depth)}${text}`;
    const opens = (text.match(/[{([]/g) ?? []).length;
    const closes = (text.match(/[}\])]/g) ?? []).length;
    depth = Math.max(0, depth + opens - closes + (closesFirst ? 1 : 0));
    return result;
  });

  return `${formatted.join('\n')}\n`;
}

/** Sort the selected text (or the whole document) alphabetically. */
export function sortLines(source: string, start: number, end: number, descending = false): { value: string; start: number; end: number } {
  const hasSelection = end > start;
  const from = hasSelection ? source.lastIndexOf('\n', start - 1) + 1 : 0;
  const to = hasSelection ? source.indexOf('\n', end) : -1;
  const sliceEnd = to === -1 ? source.length : to;
  const block = source.slice(from, sliceEnd);
  const rows = block.split('\n');
  const sorted = rows.slice().sort((a, b) => a.localeCompare(b));
  if (descending) sorted.reverse();
  const replacement = sorted.join('\n');
  return {
    value: source.slice(0, from) + replacement + source.slice(sliceEnd),
    start: from,
    end: from + replacement.length,
  };
}
