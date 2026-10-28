/**
 * A deliberately small Markdown parser for the Documentation app.
 *
 * It supports the subset the repository docs actually use — headings,
 * paragraphs, ordered/unordered lists, fenced code, blockquotes, tables,
 * horizontal rules, and inline code/bold/italic/links. It never produces raw
 * HTML: inline markup is turned into React nodes by the caller, so a stray
 * `<script>` in a document renders as text.
 */

export type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'rule' };

/** Stable anchor id for a heading (used by the "jump to section" list). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const isTableDivider = (line: string): boolean => /^\|?[\s:-]*-[\s|:-]*\|?$/.test(line.trim()) && line.includes('-');

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    // fenced code
    if (/^```/.test(line)) {
      const language = line.slice(3).trim();
      const buffer: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ type: 'code', language, code: buffer.join('\n') });
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2].replace(/\s+#+\s*$/, '').trim();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4,
        text,
        id: slugify(text),
      });
      index += 1;
      continue;
    }

    // table: header row followed by a divider row
    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const head = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buffer: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        buffer.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: buffer.join(' ').trim() });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/;
    const numbered = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const matcher = ordered ? numbered : bullet;
      const items: string[] = [];
      while (index < lines.length) {
        const match = matcher.exec(lines[index]);
        if (!match) break;
        let item = match[1].trim();
        index += 1;
        // continuation lines (indented) belong to the same item
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !matcher.test(lines[index])) {
          item += ` ${lines[index].trim()}`;
          index += 1;
        }
        items.push(item);
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // paragraph: collect until a blank line or another block starts
    const buffer: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      const current = lines[index];
      if (/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(current)) break;
      buffer.push(current.trim());
      index += 1;
    }
    if (buffer.length === 0) {
      // Safety valve: never spin on an unrecognised line.
      blocks.push({ type: 'paragraph', text: line.trim() });
      index += 1;
      continue;
    }
    blocks.push({ type: 'paragraph', text: buffer.join(' ') });
  }

  return blocks;
}

/** Plain text of a document, for the reader's search box. */
export function markdownToText(blocks: MdBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
        case 'quote':
          return block.text;
        case 'list':
          return block.items.join(' ');
        case 'code':
          return block.code;
        case 'table':
          return [block.head.join(' '), ...block.rows.map((row) => row.join(' '))].join(' ');
        default:
          return '';
      }
    })
    .join('\n');
}

export interface InlineToken {
  type: 'text' | 'code' | 'bold' | 'italic' | 'link';
  text: string;
  href?: string;
}

const INLINE_PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;

/** Tokenise one line of inline markdown (never returns HTML). */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push({ type: 'text', text: text.slice(cursor, start) });
    const value = match[0];
    if (value.startsWith('`')) {
      tokens.push({ type: 'code', text: value.slice(1, -1) });
    } else if (value.startsWith('**') || value.startsWith('__')) {
      tokens.push({ type: 'bold', text: value.slice(2, -2) });
    } else if (value.startsWith('*') || value.startsWith('_')) {
      tokens.push({ type: 'italic', text: value.slice(1, -1) });
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
      tokens.push({ type: 'link', text: link?.[1] ?? value, href: link?.[2] ?? '#' });
    }
    cursor = start + value.length;
  }
  if (cursor < text.length) tokens.push({ type: 'text', text: text.slice(cursor) });
  return tokens;
}
