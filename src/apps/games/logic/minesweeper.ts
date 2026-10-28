/**
 * Minesweeper rules — pure functions only, so the board can be unit-tested
 * without React and the first click is always guaranteed to be safe.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface BoardSpec {
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Record<Difficulty, BoardSpec> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 16, mines: 30 },
  hard: { rows: 14, cols: 20, mines: 52 },
};

export type CellState = 'hidden' | 'revealed' | 'flagged';

export interface Cell {
  mine: boolean;
  adjacent: number;
  state: CellState;
  /** True for the mine that ended the game. */
  exploded?: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  mines: number;
  cells: Cell[];
  /** Mines have been placed (first reveal happened). */
  seeded: boolean;
  status: 'playing' | 'won' | 'lost';
  flags: number;
  revealed: number;
}

export type Rng = () => number;

/** Deterministic PRNG so tests can rely on exact boards. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBoard(difficulty: Difficulty): Board {
  const spec = DIFFICULTIES[difficulty];
  return {
    rows: spec.rows,
    cols: spec.cols,
    mines: spec.mines,
    cells: Array.from({ length: spec.rows * spec.cols }, () => ({
      mine: false,
      adjacent: 0,
      state: 'hidden' as CellState,
    })),
    seeded: false,
    status: 'playing',
    flags: 0,
    revealed: 0,
  };
}

function neighbours(board: Board, index: number): number[] {
  const row = Math.floor(index / board.cols);
  const col = index % board.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) continue;
      out.push(r * board.cols + c);
    }
  }
  return out;
}

/** Place mines everywhere except the safe cell and its neighbours. */
export function seedBoard(board: Board, safeIndex: number, rng: Rng = Math.random): Board {
  const forbidden = new Set<number>([safeIndex, ...neighbours(board, safeIndex)]);
  const candidates: number[] = [];
  for (let index = 0; index < board.cells.length; index += 1) {
    if (!forbidden.has(index)) candidates.push(index);
  }
  // Very small boards: fall back to excluding only the clicked cell.
  const pool = candidates.length >= board.mines ? candidates : board.cells.map((_, index) => index).filter((i) => i !== safeIndex);

  for (let placed = 0; placed < board.mines; placed += 1) {
    const pick = Math.floor(rng() * pool.length);
    const index = pool.splice(pick, 1)[0];
    if (index === undefined) break;
    board.cells[index].mine = true;
  }

  board.cells.forEach((cell, index) => {
    if (cell.mine) return;
    cell.adjacent = neighbours(board, index).filter((n) => board.cells[n].mine).length;
  });
  board.seeded = true;
  return board;
}

function clone(board: Board): Board {
  return { ...board, cells: board.cells.map((cell) => ({ ...cell })) };
}

/** Reveal a cell (flood-fills empty areas). Returns a new board. */
export function reveal(board: Board, index: number, rng: Rng = Math.random): Board {
  if (board.status !== 'playing') return board;
  const cell = board.cells[index];
  if (!cell || cell.state !== 'hidden') return board;

  let next = board.seeded ? clone(board) : seedBoard(clone(board), index, rng);
  const target = next.cells[index];

  if (target.mine) {
    target.state = 'revealed';
    target.exploded = true;
    next.status = 'lost';
    next.revealed += 1;
    next.cells.forEach((item) => {
      if (item.mine && item.state !== 'flagged') item.state = 'revealed';
    });
    return next;
  }

  const stack = [index];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const item = next.cells[current];
    if (!item || item.state !== 'hidden' || item.mine) continue;
    item.state = 'revealed';
    next.revealed += 1;
    if (item.adjacent === 0) {
      neighbours(next, current).forEach((neighbour) => {
        if (next.cells[neighbour].state === 'hidden' && !next.cells[neighbour].mine) stack.push(neighbour);
      });
    }
  }

  if (next.revealed >= next.cells.length - next.mines) {
    next.status = 'won';
    next.cells.forEach((item) => {
      if (item.mine && item.state === 'hidden') {
        item.state = 'flagged';
      }
    });
    next.flags = next.mines;
  }
  return next;
}

/** Right-click / long-press: cycle hidden → flagged → hidden. */
export function toggleFlag(board: Board, index: number): Board {
  if (board.status !== 'playing') return board;
  const cell = board.cells[index];
  if (!cell || cell.state === 'revealed') return board;
  const next = clone(board);
  const target = next.cells[index];
  if (target.state === 'flagged') {
    target.state = 'hidden';
    next.flags -= 1;
  } else {
    if (next.flags >= next.mines) return board;
    target.state = 'flagged';
    next.flags += 1;
  }
  return next;
}

/** Reveal all hidden neighbours of a satisfied number (classic middle-click). */
export function chord(board: Board, index: number, rng: Rng = Math.random): Board {
  const cell = board.cells[index];
  if (!cell || cell.state !== 'revealed' || cell.adjacent === 0) return board;
  const around = neighbours(board, index);
  const flagged = around.filter((n) => board.cells[n].state === 'flagged').length;
  if (flagged !== cell.adjacent) return board;
  let next = board;
  for (const neighbour of around) {
    if (next.cells[neighbour].state === 'hidden') next = reveal(next, neighbour, rng);
    if (next.status !== 'playing') break;
  }
  return next;
}

export function remainingMines(board: Board): number {
  return Math.max(0, board.mines - board.flags);
}
