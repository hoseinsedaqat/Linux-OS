import { useEffect, useReducer, useRef, useState } from 'react';
import { Bomb, Flag, RefreshCw, Smile, Timer } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';
import { DIFFICULTIES, createBoard, chord, remainingMines, reveal, toggleFlag, type Board, type Difficulty } from './logic/minesweeper';
import { gamesStore, recordResult } from './gamesStore';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const NUMBER_COLORS = ['', '#5aa9ff', '#3ddc97', '#ff7a90', '#a586ff', '#f2b64c', '#4fd6b8', '#c9d4e0', '#9aa7b5'];

export function MinesweeperApp(_props: AppWindowProps) {
  const t = useT();
  const [difficulty, setDifficulty] = useState<Difficulty>(() => gamesStore.get().difficulty);
  const [board, setBoard] = useState<Board>(() => createBoard(difficulty));
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState<number | null>(() => gamesStore.get().minesBest[difficulty]);
  const [record, setRecord] = useState(false);
  const [tickKey, bump] = useReducer((value: number) => value + 1, 0);
  const timerRef = useRef<number | null>(null);
  const longPress = useRef<number | null>(null);

  const restart = (nextDifficulty: Difficulty = difficulty) => {
    setDifficulty(nextDifficulty);
    gamesStore.set((current) => ({ ...current, difficulty: nextDifficulty }));
    setBoard(createBoard(nextDifficulty));
    setSeconds(0);
    setRecord(false);
    setBest(gamesStore.get().minesBest[nextDifficulty]);
    bump();
  };

  useEffect(() => {
    if (board.status !== 'playing' || !board.seeded) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setInterval(() => setSeconds((value) => Math.min(value + 1, 999)), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [board.status, board.seeded]);

  useEffect(() => {
    if (board.status !== 'won') return;
    const isRecord = recordResult('minesweeper', seconds, { difficulty });
    setRecord(isRecord);
    setBest(gamesStore.get().minesBest[difficulty]);
  }, [board.status, seconds, difficulty]);

  const onCell = (index: number) => {
    if (board.status !== 'playing') return;
    if (board.cells[index].state === 'revealed') setBoard((current) => chord(current, index));
    else setBoard((current) => reveal(current, index));
  };

  const onFlag = (index: number) => {
    if (board.status !== 'playing') return;
    setBoard((current) => toggleFlag(current, index));
  };

  return (
    <div className="app game mines">
      <div className="game__bar">
        <div className="game__stats">
          <span className="game__stat" title={t('Mines left')}>
            <Flag size={13} /> {remainingMines(board)}
          </span>
          <span className="game__stat" title={t('Time')}>
            <Timer size={13} /> {formatTime(seconds)}
          </span>
          <span className="game__stat" title={t('Best time')}>
            <Bomb size={13} /> {best === null ? '—' : formatTime(best)}
          </span>
        </div>
        <div className="game__bar-actions">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
            <button
              key={level}
              className={cn('game__chip', difficulty === level && 'is-active')}
              onClick={() => restart(level)}
            >
              {t(level === 'easy' ? 'Easy' : level === 'medium' ? 'Medium' : 'Hard')}
            </button>
          ))}
          <button className="game__btn" onClick={() => restart()} title={t('New game')}>
            <RefreshCw size={13} /> {t('New game')}
          </button>
        </div>
      </div>

      <div className="game__stage mines__stage" key={tickKey}>
        <div
          className="mines__board"
          style={{ gridTemplateColumns: `repeat(${board.cols}, var(--mines-cell))` }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {board.cells.map((cell, index) => {
            const open = cell.state === 'revealed';
            const flagged = cell.state === 'flagged';
            return (
              <button
                key={index}
                className={cn(
                  'mines__cell',
                  open && 'is-open',
                  flagged && 'is-flagged',
                  cell.exploded && 'is-exploded',
                  open && cell.mine && 'is-mine',
                )}
                style={open && !cell.mine && cell.adjacent > 0 ? { color: NUMBER_COLORS[cell.adjacent] } : undefined}
                onClick={() => onCell(index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onFlag(index);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== 'touch') return;
                  longPress.current = window.setTimeout(() => onFlag(index), 380);
                }}
                onPointerUp={() => {
                  if (longPress.current) window.clearTimeout(longPress.current);
                }}
                onPointerCancel={() => {
                  if (longPress.current) window.clearTimeout(longPress.current);
                }}
                aria-label={
                  open
                    ? cell.mine
                      ? t('Mine')
                      : t('{count} neighbouring mines', { count: cell.adjacent })
                    : flagged
                      ? t('Flagged')
                      : t('Hidden cell')
                }
              >
                {open && cell.mine && <Bomb size={15} />}
                {open && !cell.mine && cell.adjacent > 0 && cell.adjacent}
                {flagged && <Flag size={13} />}
              </button>
            );
          })}
        </div>

        {board.status !== 'playing' && (
          <div className={cn('game__overlay', board.status === 'won' ? 'is-win' : 'is-lose')}>
            <div className="game__overlay-icon">
              {board.status === 'won' ? <Smile size={26} /> : <Bomb size={26} />}
            </div>
            <strong>{board.status === 'won' ? t('Field cleared!') : t('Boom!')}</strong>
            <p>
              {board.status === 'won'
                ? record
                  ? t('New record: {time}', { time: formatTime(seconds) })
                  : t('Finished in {time}', { time: formatTime(seconds) })
                : t('You hit a mine after {time}.', { time: formatTime(seconds) })}
            </p>
            <button className="btn btn--primary" onClick={() => restart()}>
              <RefreshCw size={13} /> {t('Play again')}
            </button>
          </div>
        )}
      </div>

      <div className="game__hint">
        {t('Left-click to reveal · right-click to flag · click a number to chord')} · {DIFFICULTIES[difficulty].mines}{' '}
        {t('mines')}
      </div>
    </div>
  );
}
