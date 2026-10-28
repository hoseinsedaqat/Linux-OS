/** 2048 rules — pure, deterministic when an RNG is injected. */

export type Grid = number[][];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Rng = () => number;

export const SIZE = 4;

export function emptyGrid(size = SIZE): Grid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

/** Put a 2 (90%) or 4 (10%) on a random empty cell. */
export function spawn(grid: Grid, rng: Rng = Math.random): Grid {
  const empty: Array<[number, number]> = [];
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === 0) empty.push([r, c]);
    }),
  );
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(rng() * empty.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = rng() < 0.9 ? 2 : 4;
  return next;
}

export function startGrid(rng: Rng = Math.random): Grid {
  return spawn(spawn(emptyGrid(), rng), rng);
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const compact = line.filter((value) => value !== 0);
  const output: number[] = [];
  let gained = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const merged = compact[index] * 2;
      output.push(merged);
      gained += merged;
      index += 1;
    } else {
      output.push(compact[index]);
    }
  }
  while (output.length < line.length) output.push(0);
  return { line: output, gained };
}

function transpose(grid: Grid): Grid {
  return grid[0].map((_, c) => grid.map((row) => row[c]));
}

export function move(grid: Grid, direction: Direction): { grid: Grid; gained: number; moved: boolean } {
  const rotate = direction === 'up' || direction === 'down';
  const work = rotate ? transpose(grid) : grid.map((row) => [...row]);
  const flip = direction === 'right' || direction === 'down';
  let gained = 0;

  const processed = work.map((row) => {
    const line = flip ? [...row].reverse() : row;
    const result = slideLine(line);
    gained += result.gained;
    return flip ? result.line.reverse() : result.line;
  });

  const next = rotate ? transpose(processed) : processed;
  const moved = next.some((row, r) => row.some((value, c) => value !== grid[r][c]));
  return { grid: next, gained, moved };
}

export function canMove(grid: Grid): boolean {
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid[r].length; c += 1) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < grid[r].length && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < grid.length && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function hasWon(grid: Grid): boolean {
  return grid.some((row) => row.some((value) => value >= 2048));
}

export function bestTile(grid: Grid): number {
  return grid.reduce((best, row) => Math.max(best, ...row), 0);
}

export interface Game2048State {
  grid: Grid;
  score: number;
  won: boolean;
  over: boolean;
}

export function applyMove(
  state: Game2048State,
  direction: Direction,
  rng: Rng = Math.random,
): { state: Game2048State; moved: boolean } {
  if (state.over) return { state, moved: false };
  const { grid, gained, moved } = move(state.grid, direction);
  if (!moved) return { state, moved: false };
  const withSpawn = spawn(grid, rng);
  return {
    moved: true,
    state: {
      grid: withSpawn,
      score: state.score + gained,
      won: state.won || hasWon(withSpawn),
      over: !canMove(withSpawn),
    },
  };
}
