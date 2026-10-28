import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_LABEL,
  STARTER_FILES,
  caretPosition,
  detectLanguage,
  findInFile,
  indentSelection,
  lineCount,
  tokenize,
} from '@/apps/code/codeUtils';
import { CODE_EXTENSIONS, fileAppFor } from '@/core/apps/types';
import type { FSNode } from '@/types';

const textNode = (name: string): FSNode => ({
  id: 'f1',
  parentId: 'dir-projects',
  name,
  kind: 'text',
  content: '',
  createdAt: 0,
  modifiedAt: 0,
});

describe('language detection', () => {
  it('maps common extensions', () => {
    expect(detectLanguage('main.ts')).toBe('ts');
    expect(detectLanguage('App.tsx')).toBe('ts');
    expect(detectLanguage('style.css')).toBe('css');
    expect(detectLanguage('data.json')).toBe('json');
    expect(detectLanguage('README.md')).toBe('md');
    expect(detectLanguage('script.sh')).toBe('sh');
    expect(detectLanguage('notes.txt')).toBe('text');
    expect(detectLanguage('Makefile')).toBe('text');
  });

  it('labelles every language', () => {
    for (const language of Object.keys(LANGUAGE_LABEL)) {
      expect(LANGUAGE_LABEL[language as keyof typeof LANGUAGE_LABEL].length).toBeGreaterThan(2);
    }
  });
});

describe('tokenizer', () => {
  it('classifies comments, strings, numbers and keywords in TypeScript', () => {
    const tokens = tokenize('// header\nconst answer = 42;\nexport function hi() { return "ok"; }', 'ts');
    const types = tokens.map((token) => token.type);
    expect(types).toContain('comment');
    expect(types).toContain('keyword');
    expect(types).toContain('number');
    expect(types).toContain('string');
    expect(tokens.some((token) => token.type === 'function' && token.text === 'hi')).toBe(true);
    expect(tokens.map((token) => token.text).join('')).toBe(
      '// header\nconst answer = 42;\nexport function hi() { return "ok"; }',
    );
  });

  it('never loses or duplicates characters', () => {
    for (const [language, sample] of Object.entries({
      ts: 'const a = `tpl ${1 + 1}`; /* block */',
      css: '.a { --x: 4px; /* note */ color: "#fff"; }',
      html: '<!-- c --><div class="x">text</div>',
      md: '# Title\n\n**bold** and `code`',
      json: '{"a": 1, "b": true}',
      py: '# note\ndef f(x):\n    return "y"',
      sh: '#!/bin/sh\necho "hi" # done',
    })) {
      const tokens = tokenize(sample, language as never);
      expect(tokens.map((token) => token.text).join('')).toBe(sample);
    }
  });

  it('returns a single plain token for unknown languages', () => {
    expect(tokenize('hello world', 'text')).toEqual([{ text: 'hello world', type: 'plain' }]);
    expect(tokenize('', 'ts')).toEqual([]);
  });

  it('does not treat property names as keywords', () => {
    const tokens = tokenize('const kind = obj.return;', 'js');
    const keywordTexts = tokens.filter((token) => token.type === 'keyword').map((token) => token.text);
    expect(keywordTexts).toContain('const');
    expect(keywordTexts).not.toContain('return');
  });
});

describe('caret maths', () => {
  it('reports 1-based line and column', () => {
    expect(caretPosition('abc', 0)).toEqual({ line: 1, column: 1 });
    expect(caretPosition('abc', 3)).toEqual({ line: 1, column: 4 });
    expect(caretPosition('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(caretPosition('ab\ncd', 999)).toEqual({ line: 2, column: 3 });
  });

  it('counts lines', () => {
    expect(lineCount('')).toBe(1);
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb\nc')).toBe(3);
  });
});

describe('in-file search', () => {
  it('is case-insensitive and reports line/column', () => {
    const source = 'const a = 1;\n// TODO fix\nconst todo = 2;';
    const hits = findInFile(source, 'todo');
    expect(hits).toHaveLength(2);
    expect(hits[0].line).toBe(2);
    expect(hits[1].line).toBe(3);
    expect(hits[1].column).toBe(7);
  });

  it('returns nothing for an empty needle', () => {
    expect(findInFile('abc', '  ')).toEqual([]);
  });

  it('caps the number of hits', () => {
    const source = Array.from({ length: 400 }, () => 'x').join('\n');
    expect(findInFile(source, 'x', 10)).toHaveLength(10);
  });
});

describe('indentation', () => {
  it('indents every selected line by two spaces', () => {
    const source = 'a\nb\nc';
    const result = indentSelection(source, 2, 3);
    expect(result.value).toBe('a\n  b\nc');
  });

  it('dedents up to two spaces', () => {
    const result = indentSelection('a\n    b', 2, 6, true);
    expect(result.value).toBe('a\n  b');
  });

  it('keeps the selection inside the edited block', () => {
    const result = indentSelection('one\ntwo', 4, 7);
    expect(result.value.slice(result.start, result.end)).toBe('  two');
  });
});

describe('editor file routing', () => {
  it('opens code files in the editor and prose in Writer', () => {
    expect(fileAppFor(textNode('main.ts'))).toBe('code');
    expect(fileAppFor(textNode('theme.css'))).toBe('code');
    expect(fileAppFor(textNode('data.json'))).toBe('code');
    expect(fileAppFor(textNode('notes.txt'))).toBe('writer');
    expect(fileAppFor(textNode('README.md'))).toBe('writer');
  });

  it('keeps the editor extension list in sync with the routing', () => {
    for (const extension of CODE_EXTENSIONS) {
      expect(fileAppFor(textNode(`file.${extension}`))).toBe('code');
    }
  });

  it('ships starter files that all use known languages', () => {
    const names = Object.keys(STARTER_FILES);
    expect(names.length).toBeGreaterThanOrEqual(4);
    names.forEach((name) => {
      expect(STARTER_FILES[name].length).toBeGreaterThan(10);
      expect(detectLanguage(name)).not.toBe('text');
    });
  });
});
