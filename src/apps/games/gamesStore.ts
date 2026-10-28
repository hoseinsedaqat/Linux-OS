import { PersistedValue } from '@/core/persistence/kvStore';
import type { Difficulty } from './logic/minesweeper';
import type { Level } from './logic/tictactoe';

export type GameId = 'minesweeper' | 'game2048' | 'snake' | 'tictactoe';

export interface GamesData {
  /** Best score per game (lower is better for minesweeper = fastest time). */
  best: Record<string, number>;
  /** Best minesweeper time per difficulty, in seconds. */
  minesBest: Record<Difficulty, number | null>;
  difficulty: Difficulty;
  level: Level;
  snakeSpeed: 'calm' | 'normal' | 'fast';
  played: number;
  lastPlayed: Record<string, number>;
}

const initial: GamesData = {
  best: {},
  minesBest: { easy: null, medium: null, hard: null },
  difficulty: 'easy',
  level: 'medium',
  snakeSpeed: 'normal',
  played: 0,
  lastPlayed: {},
};

export const gamesStore = new PersistedValue<GamesData>('nova-linux.games.v1', initial);

/** Record a finished round; returns true when it set a new record. */
export function recordResult(game: GameId, score: number, detail?: { difficulty?: Difficulty }): boolean {
  let record = false;
  gamesStore.set((current) => {
    const next: GamesData = {
      ...current,
      best: { ...current.best },
      minesBest: { ...current.minesBest },
      lastPlayed: { ...current.lastPlayed, [game]: Date.now() },
      played: current.played + 1,
    };
    if (game === 'minesweeper') {
      const difficulty = detail?.difficulty ?? current.difficulty;
      const previous = next.minesBest[difficulty];
      if (previous === null || score < previous) {
        next.minesBest[difficulty] = score;
        record = true;
      }
    } else {
      const previous = next.best[game] ?? 0;
      if (score > previous) {
        next.best[game] = score;
        record = true;
      }
    }
    return next;
  });
  return record;
}

export function bestFor(data: GamesData, game: GameId): number | null {
  if (game === 'minesweeper') return data.minesBest[data.difficulty];
  return data.best[game] ?? null;
}

export const GAME_LABELS: Record<GameId, { name: string; tagline: string; howTo: string[] }> = {
  minesweeper: {
    name: 'Minesweeper',
    tagline: 'Clear the field without touching a mine.',
    howTo: [
      'Left-click a tile to reveal it; the first click is always safe.',
      'Right-click (or long-press) to place a flag.',
      'Click a revealed number once all of its mines are flagged to open the rest.',
    ],
  },
  game2048: {
    name: '2048',
    tagline: 'Slide tiles, merge numbers, reach 2048.',
    howTo: ['Use the arrow keys or WASD to slide the whole board.', 'Equal tiles merge and double; new tiles appear every move.', 'One level of undo is available.'],
  },
  snake: {
    name: 'Snake',
    tagline: 'Eat, grow, and do not bite yourself.',
    howTo: ['Steer with the arrow keys or WASD (swipe on touch).', 'Space pauses the game.', 'Every 5 apples make the snake a little faster.'],
  },
  tictactoe: {
    name: 'Tic-Tac-Toe',
    tagline: 'Beat the computer — if you can.',
    howTo: ['You are X and always move first.', 'The hard level plays perfectly: a draw is the best result.', 'Switch to two players to play with a friend on the same screen.'],
  },
};
