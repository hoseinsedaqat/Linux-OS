import type { FSNode } from '@/types';
import {
  HOME_PATH,
  childrenOf,
  findByPath,
  normalizePath,
  pathOf,
  resolvePath,
  type NodeMap,
} from '@/core/virtual-filesystem/fsUtils';
import { formatBytes } from '@/utils';

/**
 * The simulated shell.
 *
 * Everything here is pure: it reads a snapshot of the virtual file system and
 * returns text plus a list of *effects* (create folder, write file, open node…)
 * that the terminal component applies to the real store. That makes pipelines,
 * redirections and the commands themselves unit-testable without a DOM.
 */

export interface ShellLine {
  kind: 'output' | 'error' | 'muted' | 'success';
  text: string;
}

export type ShellEffect =
  | { type: 'mkdir'; parentPath: string; name: string }
  | { type: 'touch'; parentPath: string; name: string; content?: string }
  | { type: 'write'; path: string; content: string }
  | { type: 'remove'; path: string; recursive: boolean }
  | { type: 'open'; path: string };

export interface ShellOutcome {
  lines: ShellLine[];
  effects: ShellEffect[];
  /** New working directory when `cd` succeeded. */
  cwd?: string;
  /** `clear` was run. */
  clear?: boolean;
}

export interface ShellContext {
  nodes: NodeMap;
  cwd: string;
  history: string[];
  language: 'en' | 'fa';
}

export const SHELL_HELP = `Available commands:
  help                    show this help
  clear                   clear the screen
  pwd                     print the working directory
  ls [-l] [path]          list a directory
  cd [path]               change directory (.. and ~ supported)
  cat <file>…             print files
  echo <text>             print text (> file, >> file to write)
  mkdir <name>…           create directories
  touch <name>…           create empty files
  rm [-r] <path>…         remove files (folders need -r)
  grep [-i] [-v] [-n] <pattern>   filter lines
  head [-n N] / tail [-n N]       first / last lines (default 10)
  wc [-l|-w|-c]           count lines, words or characters
  sort [-r]               sort lines
  uniq                    drop duplicate adjacent lines
  find [path]             list files below a directory
  tree [path]             directory tree
  uname [-a]              simulated system description
  date | time | whoami    simulated identity
  history                 command history
  neofetch                system summary
  open <path>             open a file in the desktop

Pipelines and redirections work:  ls | grep .ts | wc -l
                                   echo "hello" > notes.txt`;

/** Split a command line on a separator, respecting quotes and escapes. */
export function splitUnquoted(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '\\' && index + 1 < input.length && quote !== "'") {
      current += input[index + 1];
      index += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === separator) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Tokenise one command, keeping quoted arguments together. */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '\\' && index + 1 < input.length && quote !== "'") {
      current += input[index + 1];
      index += 1;
      started = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }
  if (started) tokens.push(current);
  return tokens;
}

const err = (text: string): ShellLine => ({ kind: 'error', text });
const out = (text: string): ShellLine => ({ kind: 'output', text });

function resolve(ctx: ShellContext, target: string): string {
  return resolvePath(ctx.nodes, ctx.cwd, target.replace(/^~(?=\/|$)/, HOME_PATH));
}

function nodeAt(ctx: ShellContext, target: string): FSNode | undefined {
  return findByPath(ctx.nodes, resolve(ctx, target));
}

interface StageResult {
  lines: ShellLine[];
  stdout: string;
  effects: ShellEffect[];
  cwd?: string;
  clear?: boolean;
}

function stripFlags(args: string[]): { flags: Set<string>, rest: string[] } {
  const flags = new Set<string>();
  const rest: string[] = [];
  for (const arg of args) {
    if (/^-[a-zA-Z]+$/.test(arg)) {
      for (const flag of arg.slice(1)) flags.add(flag);
    } else {
      rest.push(arg);
    }
  }
  return { flags, rest };
}

function runStage(ctx: ShellContext, stage: string, stdin: string): StageResult {
  const tokens = tokenizeCommand(stage.trim());
  const name = tokens.shift() ?? '';
  const { flags, rest } = stripFlags(tokens);
  const result: StageResult = { lines: [], stdout: '', effects: [] };
  const finish = (text: string, lines?: ShellLine[]): StageResult => {
    result.stdout = text;
    result.lines = lines ?? (text ? [out(text)] : []);
    return result;
  };
  const fail = (text: string): StageResult => {
    result.lines = [err(text)];
    result.stdout = '';
    return result;
  };

  switch (name) {
    case '': {
      return result;
    }
    case 'help':
      return finish(SHELL_HELP);
    case 'clear': {
      result.clear = true;
      return result;
    }
    case 'pwd':
      return finish(ctx.cwd);
    case 'whoami':
      return finish('demo');
    case 'date':
      return finish(
        new Date().toLocaleDateString(ctx.language === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'full' }),
      );
    case 'time':
      return finish(new Date().toLocaleTimeString(ctx.language === 'fa' ? 'fa-IR' : 'en-US'));
    case 'uname': {
      if (flags.has('a') || rest.includes('-a')) {
        return finish('NOVA Linux 1.0 nova-sh (web simulator) — no kernel, no hardware access');
      }
      return finish('NOVA Linux');
    }
    case 'ls': {
      const target = rest[0] ?? '.';
      const node = nodeAt(ctx, target);
      if (!node) return fail(`ls: cannot access '${target}': No such file or directory`);
      if (node.kind !== 'folder') return finish(node.name);
      const children = childrenOf(ctx.nodes, node.id);
      if (children.length === 0) return finish('');
      if (flags.has('l')) {
        const rows = children.map((child) => {
          const size = child.kind === 'folder' ? '     -' : formatBytes(child.content?.length ?? 0).padStart(6);
          return `${child.kind === 'folder' ? 'd' : '-'}rw-r--r--  ${size}  ${child.name}${child.kind === 'folder' ? '/' : ''}`;
        });
        return finish(rows.join('\n'));
      }
      // One entry per line, like a real `ls` whose output is being piped: it
      // keeps `ls | grep … | wc -l` honest instead of counting one long row.
      return finish(children.map((child) => (child.kind === 'folder' ? `${child.name}/` : child.name)).join('\n'));
    }
    case 'cd': {
      const target = rest[0] ?? HOME_PATH;
      const node = nodeAt(ctx, target);
      if (!node) return fail(`cd: no such file or directory: ${target}`);
      if (node.kind !== 'folder') return fail(`cd: not a directory: ${target}`);
      result.cwd = pathOf(ctx.nodes, node.id);
      return result;
    }
    case 'cat': {
      if (rest.length === 0) return finish(stdin);
      const chunks: string[] = [];
      for (const target of rest) {
        const node = nodeAt(ctx, target);
        if (!node) return fail(`cat: ${target}: No such file or directory`);
        if (node.kind === 'folder') return fail(`cat: ${target}: Is a directory`);
        chunks.push(node.content ?? '');
      }
      return finish(chunks.join('\n'));
    }
    case 'echo': {
      const text = rest.join(' ');
      return finish(text);
    }
    case 'mkdir': {
      if (rest.length === 0) return fail('mkdir: missing operand');
      if (!findByPath(ctx.nodes, ctx.cwd)) return fail('mkdir: current directory is unavailable');
      for (const target of rest) {
        result.effects.push({ type: 'mkdir', parentPath: ctx.cwd, name: target });
      }
      return result;
    }
    case 'touch': {
      if (rest.length === 0) return fail('touch: missing operand');
      for (const target of rest) {
        result.effects.push({ type: 'touch', parentPath: ctx.cwd, name: target });
      }
      return result;
    }
    case 'rm': {
      if (rest.length === 0) return fail('rm: missing operand');
      for (const target of rest) {
        const node = nodeAt(ctx, target);
        if (!node) {
          result.lines.push(err(`rm: cannot remove '${target}': No such file or directory`));
          continue;
        }
        if (node.kind === 'folder' && !flags.has('r')) {
          result.lines.push(err(`rm: cannot remove '${target}': Is a directory (use -r)`));
          continue;
        }
        result.effects.push({ type: 'remove', path: resolve(ctx, target), recursive: flags.has('r') });
      }
      return result;
    }
    case 'grep': {
      if (rest.length === 0) return fail('usage: grep [-i] [-v] [-n] <pattern> [file]');
      const pattern = rest[0];
      let source = stdin;
      if (rest[1]) {
        const node = nodeAt(ctx, rest[1]);
        if (!node) return fail(`grep: ${rest[1]}: No such file or directory`);
        source = node.content ?? '';
      }
      if (!source) return finish('');
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags.has('i') ? 'i' : '');
      } catch {
        return fail(`grep: invalid pattern: ${pattern}`);
      }
      const matches = source
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => regex.test(line) !== flags.has('v'))
        .map(({ line, index }) => (flags.has('n') ? `${index + 1}:${line}` : line));
      return finish(matches.join('\n'));
    }
    case 'head':
    case 'tail': {
      const countIndex = rest.findIndex((value) => value === '-n');
      const count = countIndex >= 0 ? Number(rest[countIndex + 1]) || 10 : Number(rest[0]) || 10;
      const rows = stdin.split('\n');
      const slice = name === 'head' ? rows.slice(0, count) : rows.slice(-count);
      return finish(slice.join('\n'));
    }
    case 'wc': {
      // Logical lines: a trailing newline does not add an extra line, which is
      // what people expect from `cat file | wc -l` here.
      const rows = stdin.split('\n');
      if (rows.at(-1) === '') rows.pop();
      const lines = stdin ? rows.length : 0;
      const words = stdin.trim() ? stdin.trim().split(/\s+/).length : 0;
      if (flags.has('w')) return finish(String(words));
      if (flags.has('c')) return finish(String(stdin.length));
      return finish(String(lines));
    }
    case 'sort': {
      const rows = stdin.split('\n').filter((row) => row.length > 0);
      rows.sort((a, b) => a.localeCompare(b));
      if (flags.has('r')) rows.reverse();
      return finish(rows.join('\n'));
    }
    case 'uniq': {
      const rows = stdin.split('\n');
      const unique = rows.filter((row, index) => index === 0 || row !== rows[index - 1]);
      return finish(unique.join('\n'));
    }
    case 'find': {
      const start = findByPath(ctx.nodes, resolve(ctx, rest[0] ?? '.')) ?? findByPath(ctx.nodes, ctx.cwd);
      if (!start) return fail('find: cannot search here');
      const rows: string[] = [];
      const walk = (node: FSNode, depth: number) => {
        if (depth > 8) return;
        if (node.kind !== 'folder') {
          rows.push(pathOf(ctx.nodes, node.id));
          return;
        }
        for (const child of childrenOf(ctx.nodes, node.id)) walk(child, depth + 1);
      };
      walk(start, 0);
      return finish(rows.join('\n'));
    }
    case 'tree': {
      const start = findByPath(ctx.nodes, resolve(ctx, rest[0] ?? '.')) ?? findByPath(ctx.nodes, ctx.cwd);
      if (!start) return fail('tree: cannot read here');
      const rows: string[] = [start.name === 'demo' ? '~' : start.name];
      const walk = (node: FSNode, prefix: string, depth: number) => {
        if (depth > 6) return;
        const children = childrenOf(ctx.nodes, node.id);
        children.forEach((child, index) => {
          const last = index === children.length - 1;
          rows.push(`${prefix}${last ? '└── ' : '├── '}${child.name}${child.kind === 'folder' ? '/' : ''}`);
          if (child.kind === 'folder') walk(child, `${prefix}${last ? '    ' : '│   '}`, depth + 1);
        });
      };
      walk(start, '', 0);
      return finish(rows.join('\n'));
    }
    case 'history':
      return finish(ctx.history.map((entry, index) => `${index + 1}  ${entry}`).join('\n') || '(no history)');
    case 'neofetch': {
      const nodes = Object.values(ctx.nodes);
      const files = nodes.filter((node) => node.kind !== 'folder' && !node.trashed).length;
      const folders = nodes.filter((node) => node.kind === 'folder' && !node.trashed).length;
      const lines = [
        '       /\\        demo@nova',
        '      /  \\       ---------',
        '     / /\\ \\      OS: NOVA Linux 1.0 (web simulator)',
        '    / ____ \\     Kernel: none — JavaScript simulation',
        '   /_/    \\_\\    Shell: nova-sh (sandboxed)',
        `                 Files: ${files} · Folders: ${folders}`,
        `                 Locale: ${ctx.language === 'fa' ? 'fa_IR' : 'en_US'}`,
      ];
      return finish(lines.join('\n'));
    }
    case 'open': {
      if (rest.length === 0) return fail('open: missing file');
      const node = nodeAt(ctx, rest[0]);
      if (!node) return fail(`open: ${rest[0]}: No such file or directory`);
      result.effects.push({ type: 'open', path: resolve(ctx, rest[0]) });
      return finish(`Opening ${node.name}…`);
    }
    default:
      return fail(`nova-sh: ${name}: command not found. Type "help" to see available commands.`);
  }
}

/** Run one command line: pipelines, then an optional `>` / `>>` redirection. */
export function runLine(input: string, ctx: ShellContext): ShellOutcome {
  const effects: ShellEffect[] = [];
  const lines: ShellLine[] = [];

  // Redirection: `cmd > file` / `cmd >> file` (the first unquoted occurrence).
  let commandPart = input.trim();
  let redirect: { path: string; append: boolean } | null = null;
  const redirectMatch = /^(.*?)(>>|>)\s*([^\s>]+)\s*$/.exec(commandPart);
  if (redirectMatch) {
    commandPart = redirectMatch[1].trim();
    redirect = { path: redirectMatch[3], append: redirectMatch[2] === '>>' };
  }

  const stages = splitUnquoted(commandPart, '|').map((stage) => stage.trim());
  let stdin = '';
  let cwd: string | undefined;
  let last: StageResult | null = null;

  for (const stage of stages) {
    const result = runStage(ctx, stage, stdin);
    effects.push(...result.effects);
    const errors = result.lines.filter((line) => line.kind === 'error');
    lines.push(...errors);
    if (result.clear) return { lines: [], effects, clear: true };
    if (result.cwd) {
      cwd = result.cwd;
      ctx = { ...ctx, cwd: result.cwd };
    }
    if (errors.length > 0) return { lines, effects, cwd };
    stdin = result.stdout;
    last = result;
  }

  if (redirect) {
    const content = stdin && !stdin.endsWith('\n') ? `${stdin}\n` : stdin;
    effects.push({ type: 'write', path: resolve(ctx, redirect.path), content });
    lines.push({
      kind: 'success',
      text: `${redirect.append ? 'Appended to' : 'Wrote'} ${normalizePath(redirect.path)} (${content.length} chars)`,
    });
    return { lines, effects, cwd };
  }

  // Only the last stage of a pipeline reaches the screen.
  if (last) lines.push(...last.lines.filter((line) => line.kind !== 'error'));
  return { lines, effects, cwd };
}
