/** Snake rules — pure grid simulation. */

export interface Point {
  x: number;
  y: number;
}

export type Heading = 'up' | 'down' | 'left' | 'right';

export interface SnakeState {
  cols: number;
  rows: number;
  snake: Point[];
  heading: Heading;
  /** Direction queued for the next tick (prevents 180° turns). */
  pending: Heading;
  food: Point;
  score: number;
  alive: boolean;
  /** Set once every cell is filled. */
  won: boolean;
}

export type Rng = () => number;

const DIRS: Record<Heading, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Heading, Heading> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function placeFood(snake: Point[], cols: number, rows: number, rng: Rng = Math.random): Point {
  const taken = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const free: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: -1, y: -1 };
  return free[Math.floor(rng() * free.length)];
}

export function createSnake(cols = 20, rows = 15, rng: Rng = Math.random): SnakeState {
  const snake = [
    { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    { x: Math.floor(cols / 2) - 1, y: Math.floor(rows / 2) },
    { x: Math.floor(cols / 2) - 2, y: Math.floor(rows / 2) },
  ];
  return {
    cols,
    rows,
    snake,
    heading: 'right',
    pending: 'right',
    food: placeFood(snake, cols, rows, rng),
    score: 0,
    alive: true,
    won: false,
  };
}

export function turn(state: SnakeState, heading: Heading): SnakeState {
  if (!state.alive) return state;
  if (OPPOSITE[heading] === state.heading) return state;
  return { ...state, pending: heading };
}

export function tick(state: SnakeState, rng: Rng = Math.random): SnakeState {
  if (!state.alive) return state;
  const heading = state.pending;
  const delta = DIRS[heading];
  const head = state.snake[0];
  const nextHead = { x: head.x + delta.x, y: head.y + delta.y };

  const hitsWall =
    nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= state.cols || nextHead.y >= state.rows;
  const eating = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = body.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitsWall || hitsSelf) {
    return { ...state, heading, alive: false };
  }

  const snake = [nextHead, ...body];
  const score = eating ? state.score + 10 : state.score;

  if (eating) {
    const food = placeFood(snake, state.cols, state.rows, rng);
    if (food.x === -1) {
      return { ...state, heading, snake, score, food, won: true, alive: false };
    }
    return { ...state, heading, snake, score, food };
  }
  return { ...state, heading, snake, score };
}

export function speedFor(score: number, base = 150): number {
  return Math.max(55, base - Math.floor(score / 50) * 10);
}
