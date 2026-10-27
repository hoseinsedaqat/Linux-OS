/**
 * Small, safe arithmetic engine used by Calc and the Calculator app.
 * It never evaluates JavaScript — only the grammar implemented below.
 */

export interface EvalContext {
  /** Resolve a spreadsheet reference such as A1 or a whole range. */
  resolveRange?: (from: string, to: string) => number[];
  resolveCell?: (ref: string) => number;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ref'; value: string }
  | { type: 'range'; from: string; to: string }
  | { type: 'func'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

const FUNCTIONS = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ABS', 'ROUND', 'SQRT', 'IF', 'PI']);

export class FormulaError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === ' ' || char === '\t' || char === '\n') {
      index += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma' });
      index += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }
    if ('+-*/^%'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      index += 1;
      continue;
    }
    if (char === '=') {
      // A leading equals sign is stripped by the caller; inner '=' is invalid.
      throw new FormulaError('Unexpected "="');
    }
    if (/\d/.test(char) || (char === '.' && /\d/.test(input[index + 1] ?? ''))) {
      let number = '';
      while (index < input.length && /[\d.]/.test(input[index])) {
        number += input[index];
        index += 1;
      }
      if (Number.isNaN(Number(number))) throw new FormulaError(`Invalid number: ${number}`);
      tokens.push({ type: 'number', value: Number(number) });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let word = '';
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index])) {
        word += input[index];
        index += 1;
      }
      // Range reference A1:B4
      if (input[index] === ':' && /^[A-Za-z]{1,3}\d+$/.test(word)) {
        index += 1;
        let second = '';
        while (index < input.length && /[A-Za-z0-9]/.test(input[index])) {
          second += input[index];
          index += 1;
        }
        if (!/^[A-Za-z]{1,3}\d+$/.test(second)) throw new FormulaError(`Invalid range: ${word}:${second}`);
        tokens.push({ type: 'range', from: word.toUpperCase(), to: second.toUpperCase() });
        continue;
      }
      const upper = word.toUpperCase();
      if (FUNCTIONS.has(upper)) {
        tokens.push({ type: 'func', value: upper });
        continue;
      }
      if (/^[A-Za-z]{1,3}\d+$/.test(word)) {
        tokens.push({ type: 'ref', value: word.toUpperCase() });
        continue;
      }
      throw new FormulaError(`Unknown name: ${word}`);
    }
    throw new FormulaError(`Unexpected character: ${char}`);
  }
  return tokens;
}

class Parser {
  private tokens: Token[];
  private position = 0;
  private context: EvalContext;

  constructor(tokens: Token[], context: EvalContext) {
    this.tokens = tokens;
    this.context = context;
  }

  parse(): number {
    if (this.tokens.length === 0) return 0;
    const value = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new FormulaError('Unexpected token at end of formula');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private consume(): Token {
    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (this.peek()?.type === 'op' && ['+', '-'].includes((this.peek() as { value: string }).value)) {
      const op = this.consume() as { type: 'op'; value: string };
      const right = this.parseTerm();
      left = op.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parsePower();
    while (
      this.peek()?.type === 'op' &&
      ['*', '/', '%'].includes((this.peek() as { value: string }).value)
    ) {
      const op = this.consume() as { type: 'op'; value: string };
      const right = this.parsePower();
      if (op.value === '*') left *= right;
      else if (op.value === '/') {
        if (right === 0) throw new FormulaError('Division by zero');
        left /= right;
      } else left %= right;
    }
    return left;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    if (this.peek()?.type === 'op' && (this.peek() as { value: string }).value === '^') {
      this.consume();
      return base ** this.parsePower();
    }
    return base;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token?.type === 'op' && (token.value === '-' || token.value === '+')) {
      this.consume();
      const value = this.parseUnary();
      return token.value === '-' ? -value : value;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.consume();
    if (!token) throw new FormulaError('Unexpected end of formula');
    switch (token.type) {
      case 'number':
        return token.value;
      case 'ref':
        if (!this.context.resolveCell) throw new FormulaError('Cell references are not available');
        return this.context.resolveCell(token.value);
      case 'range':
        throw new FormulaError('A range can only be used inside a function');
      case 'paren':
        if (token.value === '(') {
          const value = this.parseExpression();
          const close = this.consume();
          if (!close || close.type !== 'paren' || close.value !== ')') throw new FormulaError('Missing ")"');
          return value;
        }
        throw new FormulaError('Unexpected ")"');
      case 'func':
        return this.parseFunction(token.value);
      default:
        throw new FormulaError('Unexpected token');
    }
  }

  private parseArguments(): Array<number | number[]> {
    const args: Array<number | number[]> = [];
    const next = this.peek();
    if (next?.type === 'paren' && next.value === ')') return args;
    for (;;) {
      const token = this.peek();
      if (token?.type === 'range') {
        this.consume();
        if (!this.context.resolveRange) throw new FormulaError('Ranges are not available');
        args.push(this.context.resolveRange(token.from, token.to));
      } else {
        args.push(this.parseExpression());
      }
      const separator = this.peek();
      if (separator?.type === 'comma') {
        this.consume();
        continue;
      }
      break;
    }
    return args;
  }

  private parseFunction(name: string): number {
    const open = this.consume();
    if (!open || open.type !== 'paren' || open.value !== '(') throw new FormulaError(`Missing "(" after ${name}`);
    if (name === 'PI') {
      const close = this.consume();
      if (!close || close.type !== 'paren' || close.value !== ')') throw new FormulaError('PI takes no arguments');
      return Math.PI;
    }
    const args = this.parseArguments();
    const close = this.consume();
    if (!close || close.type !== 'paren' || close.value !== ')') throw new FormulaError('Missing ")"');
    const numbers = args.flatMap((arg) => (Array.isArray(arg) ? arg : [arg])).filter((value) => Number.isFinite(value));
    const raw = args.flatMap((arg) => (Array.isArray(arg) ? arg : [arg]));
    switch (name) {
      case 'SUM':
        return numbers.reduce((acc, value) => acc + value, 0);
      case 'AVERAGE':
        if (numbers.length === 0) throw new FormulaError('AVERAGE needs at least one number');
        return numbers.reduce((acc, value) => acc + value, 0) / numbers.length;
      case 'MIN':
        if (numbers.length === 0) return 0;
        return Math.min(...numbers);
      case 'MAX':
        if (numbers.length === 0) return 0;
        return Math.max(...numbers);
      case 'COUNT':
        return numbers.length;
      case 'ABS':
        return Math.abs(numbers[0] ?? 0);
      case 'SQRT':
        if ((numbers[0] ?? 0) < 0) throw new FormulaError('SQRT of negative number');
        return Math.sqrt(numbers[0] ?? 0);
      case 'ROUND': {
        const digits = args[1];
        const places = Array.isArray(digits) ? 0 : Math.trunc(digits ?? 0);
        return Number((numbers[0] ?? 0).toFixed(places));
      }
      case 'IF': {
        // IF(condition is not supported — provide a clear error.)
        throw new FormulaError('IF is not supported in this simulator');
      }
      default:
        void raw;
        throw new FormulaError(`Unsupported function: ${name}`);
    }
  }
}

/** Evaluate a formula expression like "=SUM(A1:A4)*2". */
export function evaluateExpression(input: string, context: EvalContext = {}): number {
  const expression = input.trim().replace(/^=/, '');
  if (!expression) return 0;
  const parser = new Parser(tokenize(expression), context);
  const result = parser.parse();
  if (!Number.isFinite(result)) throw new FormulaError('Result is not a number');
  return result;
}

export function columnLabel(index: number): string {
  let label = '';
  let value = index;
  while (value >= 0) {
    label = String.fromCharCode((value % 26) + 65) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
}

export function columnIndex(label: string): number {
  let index = 0;
  for (const char of label.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

export function splitRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Za-z]{1,3})(\d+)$/.exec(ref.trim());
  if (!match) return null;
  return { col: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

export function refToIndex(ref: string): { col: number; row: number } | null {
  return splitRef(ref);
}

export function indexToRef(col: number, row: number): string {
  return `${columnLabel(col)}${row + 1}`;
}

export function expandRange(from: string, to: string): string[] {
  const start = splitRef(from);
  const end = splitRef(to);
  if (!start || !end) return [];
  const refs: string[] = [];
  const colStart = Math.min(start.col, end.col);
  const colEnd = Math.max(start.col, end.col);
  const rowStart = Math.min(start.row, end.row);
  const rowEnd = Math.max(start.row, end.row);
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      refs.push(indexToRef(col, row));
    }
  }
  return refs;
}
