/** Tic-tac-toe with a real minimax opponent. */

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Board = Cell[];

export type Level = 'easy' | 'medium' | 'hard';

export const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createBoard(): Board {
  return Array.from({ length: 9 }, () => null);
}

export function winnerOf(board: Board): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line };
  }
  return null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

export function isDraw(board: Board): boolean {
  return !winnerOf(board) && isFull(board);
}

export function availableMoves(board: Board): number[] {
  return board.reduce<number[]>((moves, cell, index) => {
    if (cell === null) moves.push(index);
    return moves;
  }, []);
}

function other(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}

/** Minimax with depth preference: quick wins and slow losses. */
export function minimax(board: Board, player: Mark, me: Mark, depth = 0): { score: number; move: number | null } {
  const win = winnerOf(board);
  if (win) return { score: win.mark === me ? 10 - depth : depth - 10, move: null };
  if (isFull(board)) return { score: 0, move: null };

  const moves = availableMoves(board);
  let bestScore = player === me ? -Infinity : Infinity;
  let bestMove: number | null = moves[0] ?? null;

  for (const move of moves) {
    const next = [...board];
    next[move] = player;
    const { score } = minimax(next, other(player), me, depth + 1);
    if (player === me ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { score: bestScore, move: bestMove };
}

/**
 * Choose the computer's move.
 * easy   → mostly random
 * medium → best move 65% of the time
 * hard   → always optimal (unbeatable)
 */
export function computerMove(board: Board, me: Mark, level: Level = 'hard', rng: () => number = Math.random): number | null {
  const moves = availableMoves(board);
  if (moves.length === 0) return null;
  if (level === 'easy') return moves[Math.floor(rng() * moves.length)];
  if (level === 'medium' && rng() > 0.65) return moves[Math.floor(rng() * moves.length)];
  return minimax(board, me, me).move ?? moves[0];
}

export interface Score {
  wins: number;
  losses: number;
  draws: number;
}

export function scoreKey(level: Level): string {
  return `tictactoe.${level}`;
}
