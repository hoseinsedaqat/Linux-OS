import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  chord,
  createBoard,
  mulberry32,
  remainingMines,
  reveal,
  seedBoard,
  toggleFlag,
} from '@/apps/games/logic/minesweeper';
import { applyMove, canMove, emptyGrid, hasWon, move, startGrid } from '@/apps/games/logic/g2048';
import { createSnake, placeFood, speedFor, tick, turn } from '@/apps/games/logic/snake';
import { computerMove, createBoard as tttBoard, isDraw, minimax, winnerOf } from '@/apps/games/logic/tictactoe';
import { describeWeather, forecastUrl, mapForecast, mapGeocoding, nextHours } from '@/apps/weather/weatherLogic';
import { GAME_LABELS, bestFor } from '@/apps/games/gamesStore';

const seeded = (value: number) => mulberry32(value);

describe('minesweeper logic', () => {
  it('creates an empty board of the right size', () => {
    const board = createBoard('easy');
    expect(board.cols).toBe(9);
    expect(board.rows).toBe(9);
    expect(board.cells).toHaveLength(81);
    expect(board.mines).toBe(DIFFICULTIES.easy.mines);
    expect(board.status).toBe('playing');
  });

  it('never places a mine on the first clicked cell', () => {
    for (const index of [0, 40, 80]) {
      const board = seedBoard(createBoard('easy'), index, seeded(index + 1));
      expect(board.cells[index].mine).toBe(false);
      const mines = board.cells.filter((cell) => cell.mine).length;
      expect(mines).toBe(DIFFICULTIES.easy.mines);
    }
  });

  it('counts adjacent mines correctly', () => {
    const board = seedBoard(createBoard('medium'), 0, seeded(3));
    board.cells.forEach((cell, index) => {
      if (cell.mine) return;
      const x = index % board.cols;
      const y = Math.floor(index / board.cols);
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= board.cols || ny >= board.rows) continue;
          if (board.cells[ny * board.cols + nx].mine) count += 1;
        }
      }
      expect(cell.adjacent).toBe(count);
    });
  });

  it('toggles flags inside the mine budget only', () => {
    let board = seedBoard(createBoard('easy'), 10, seeded(7));
    board = toggleFlag(board, 11);
    expect(board.cells[11].state).toBe('flagged');
    expect(remainingMines(board)).toBe(DIFFICULTIES.easy.mines - 1);
    board = toggleFlag(board, 11);
    expect(board.cells[11].state).toBe('hidden');
    expect(remainingMines(board)).toBe(DIFFICULTIES.easy.mines);
  });

  it('loses when a mine is revealed and wins when the field is clear', () => {
    let board = seedBoard(createBoard('easy'), 0, seeded(11));
    const mineIndex = board.cells.findIndex((cell) => cell.mine);
    const lost = reveal(board, mineIndex);
    expect(lost.status).toBe('lost');

    board = seedBoard(createBoard('easy'), 0, seeded(11));
    for (let index = 0; index < board.cells.length; index += 1) {
      if (board.cells[index].mine) continue;
      board = reveal(board, index);
    }
    expect(board.status).toBe('won');
  });

  it('chords only when enough flags surround a number', () => {
    const board = seedBoard(createBoard('easy'), 4, seeded(5));
    expect(chord(board, 4).cells.filter((cell) => cell.state === 'revealed')).toHaveLength(
      board.cells.filter((cell) => cell.state === 'revealed').length,
    );
  });
});

describe('2048 logic', () => {
  it('starts with two tiles', () => {
    const grid = startGrid(seeded(42));
    expect(grid.flat().filter((value) => value > 0)).toHaveLength(2);
  });

  it('merges equal tiles once per move and scores the sum', () => {
    const grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const result = move(grid, 'left');
    expect(result.grid[0]).toEqual([4, 0, 0, 0]);
    expect(result.gained).toBe(4);
    expect(result.moved).toBe(true);
  });

  it('does not merge a freshly doubled tile twice in the same move', () => {
    const grid = [
      [2, 2, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(move(grid, 'left').grid[0]).toEqual([4, 4, 0, 0]);
  });

  it('reports no movement on a full locked board', () => {
    const grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(move(grid, 'left').moved).toBe(false);
    expect(canMove(grid)).toBe(false);
  });

  it('detects a 2048 tile and applies spawning moves', () => {
    const winning = emptyGrid();
    winning[0][0] = 2048;
    expect(hasWon(winning)).toBe(true);

    const { state, moved } = applyMove({ grid: startGrid(seeded(2)), score: 0, won: false, over: false }, 'left', seeded(9));
    expect(moved).toBe(true);
    expect(state.over).toBe(false);
    expect(state.grid.flat().filter((value) => value > 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe('snake logic', () => {
  it('moves forward and keeps its length', () => {
    const state = createSnake(20, 15, seeded(1));
    const next = tick(state, seeded(2));
    expect(next.snake).toHaveLength(state.snake.length);
    expect(next.snake[0]).not.toEqual(state.snake[0]);
  });

  it('refuses to reverse into itself', () => {
    const state = createSnake(20, 15, seeded(1));
    const reversed = turn(state, state.heading === 'right' ? 'left' : 'right');
    expect(reversed.heading).toBe(state.heading);
  });

  it('produces food inside the grid and away from the body', () => {
    const snake = [{ x: 0, y: 0 }];
    const food = placeFood(snake, 20, 15, seeded(3));
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(20);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(15);
    expect(food).not.toEqual(snake[0]);
  });

  it('speeds up with the score but never below the floor', () => {
    expect(speedFor(0)).toBe(150);
    expect(speedFor(500)).toBeLessThan(speedFor(100));
    expect(speedFor(100000)).toBe(55);
  });

  it('ends the game when hitting a wall', () => {
    let state = createSnake(4, 4, seeded(4));
    state = { ...state, heading: 'left', pending: 'left' };
    state = tick(state, seeded(1));
    expect(state.alive).toBe(false);
  });
});

describe('tic-tac-toe logic', () => {
  it('detects winners on rows, columns and diagonals', () => {
    expect(winnerOf(['X', 'X', 'X', null, null, null, null, null, null])?.mark).toBe('X');
    expect(winnerOf(['O', null, null, 'O', null, null, 'O', null, null])?.mark).toBe('O');
    expect(winnerOf(['X', null, null, null, 'X', null, null, null, 'X'])?.mark).toBe('X');
    expect(winnerOf(tttBoard())).toBeNull();
  });

  it('detects a draw on a full board', () => {
    expect(isDraw(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBe(true);
  });

  it('takes an immediate win on the hard level', () => {
    const board: Array<'X' | 'O' | null> = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(computerMove(board, 'O', 'hard')).toBe(2);
  });

  it('blocks the opponent on the hard level', () => {
    const board: Array<'X' | 'O' | null> = ['X', 'X', null, null, 'O', null, null, null, null];
    expect(computerMove(board, 'O', 'hard')).toBe(2);
  });

  it('never loses as O when playing perfectly against a random opponent', () => {
    const board = tttBoard();
    board[4] = 'X';
    let state: Array<'X' | 'O' | null> = [...board];
    let turn: 'X' | 'O' = 'O';
    let guard = 0;
    while (!winnerOf(state) && !isDraw(state) && guard < 20) {
      if (turn === 'O') {
        const moveIndex = computerMove(state, 'O', 'hard');
        if (moveIndex === null) break;
        state[moveIndex] = 'O';
        turn = 'X';
      } else {
        const empty = state.map((cell, index) => (cell === null ? index : -1)).filter((index) => index >= 0);
        if (empty.length === 0) break;
        state[empty[0]] = 'X';
        turn = 'O';
      }
      guard += 1;
    }
    expect(winnerOf(state)?.mark).not.toBe('X');
  });

  it('scores a perfect game as a draw for the opponent', () => {
    expect(minimax(tttBoard(), 'O', 'O').score).toBe(0);
  });

  it('spreads easy moves across available cells', () => {
    const board = tttBoard();
    const moves = new Set<number | null>();
    for (let i = 0; i < 30; i += 1) moves.add(computerMove(board, 'O', 'easy'));
    expect(moves.size).toBeGreaterThan(1);
  });
});

describe('games store metadata', () => {
  it('labels every game with a name, tagline and how-to steps', () => {
    const ids = Object.keys(GAME_LABELS);
    expect(ids).toEqual(['minesweeper', 'game2048', 'snake', 'tictactoe']);
    for (const id of ids) {
      const label = GAME_LABELS[id as keyof typeof GAME_LABELS];
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.tagline.length).toBeGreaterThan(0);
      expect(label.howTo.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('reads the minesweeper best time from the current difficulty', () => {
    const data = {
      best: { snake: 12 },
      minesBest: { easy: 42, medium: null, hard: null },
      difficulty: 'easy' as const,
      level: 'medium' as const,
      snakeSpeed: 'normal' as const,
      played: 3,
      lastPlayed: {},
    };
    expect(bestFor(data, 'minesweeper')).toBe(42);
    expect(bestFor(data, 'snake')).toBe(12);
    expect(bestFor(data, 'game2048')).toBeNull();
  });
});

describe('weather mapping', () => {
  it('maps WMO codes to icons and labels', () => {
    expect(describeWeather(0)).toEqual({ kind: 'clear', label: 'Clear sky' });
    expect(describeWeather(3).kind).toBe('cloudy');
    expect(describeWeather(61).kind).toBe('rain');
    expect(describeWeather(75).kind).toBe('snow');
    expect(describeWeather(95).kind).toBe('storm');
    expect(describeWeather(45).kind).toBe('fog');
  });

  it('maps a geocoding payload and ignores incomplete rows', () => {
    const places = mapGeocoding({
      results: [
        { name: 'Frankfurt', country: 'Germany', latitude: 50.1, longitude: 8.6 },
        { name: 'broken' },
      ],
    });
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Frankfurt');
  });

  it('shapes an Open-Meteo response into a forecast', () => {
    const forecast = mapForecast(
      {
        current: { temperature_2m: 18.4, apparent_temperature: 17, relative_humidity_2m: 61, wind_speed_10m: 9, precipitation: 0, weather_code: 2, is_day: 1, time: '2026-10-28T12:00' },
        hourly: { time: ['2026-10-28T12:00', '2026-10-28T13:00'], temperature_2m: [18, 19], precipitation_probability: [0, 10], weather_code: [2, 3] },
        daily: { time: ['2026-10-28'], weather_code: [2], temperature_2m_max: [20], temperature_2m_min: [11], precipitation_probability_max: [5] },
        current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
      },
      { name: 'Frankfurt', latitude: 50.1, longitude: 8.6 },
    );
    expect(forecast).not.toBeNull();
    expect(forecast?.current.temperature).toBe(18.4);
    expect(forecast?.hours).toHaveLength(2);
    expect(forecast?.days[0].max).toBe(20);
    expect(forecast?.units.temperature).toBe('°C');
  });

  it('returns null for an incomplete payload instead of fabricating data', () => {
    expect(mapForecast({}, { name: 'x', latitude: 0, longitude: 0 })).toBeNull();
    expect(mapForecast({ current: { temperature_2m: 1 } }, { name: 'x', latitude: 0, longitude: 0 })).toBeNull();
  });

  it('builds keyless Open-Meteo URLs with all requested blocks', () => {
    const url = forecastUrl({ name: 'Tehran', latitude: 35.68, longitude: 51.38 });
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain('latitude=35.68');
    expect(url).toContain('current=');
    expect(url).toContain('daily=');
    expect(url).not.toContain('apikey');
  });

  it('slices the coming hours from now', () => {
    const forecast = {
      place: { name: 'x', latitude: 0, longitude: 0 },
      current: { temperature: 1, apparent: 1, humidity: 1, wind: 1, precipitation: 0, code: 0, isDay: true, time: '' },
      hours: [
        { time: '2026-10-28T10:00', temperature: 1, precipitation: 0, code: 0 },
        { time: '2026-10-28T12:00', temperature: 2, precipitation: 0, code: 0 },
        { time: '2026-10-28T13:00', temperature: 3, precipitation: 0, code: 0 },
      ],
      days: [],
      units: { temperature: '°C', wind: 'km/h' },
    };
    const hours = nextHours(forecast, new Date('2026-10-28T11:30:00'), 2);
    expect(hours.map((hour) => hour.temperature)).toEqual([2, 3]);
  });
});
