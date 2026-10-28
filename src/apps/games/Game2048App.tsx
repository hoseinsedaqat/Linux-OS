import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Trophy, Undo2 } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';
import { applyMove, bestTile, startGrid, type Direction, type Game2048State } from './logic/g2048';
import { gamesStore, recordResult } from './gamesStore';

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

function fresh(): Game2048State {
  return { grid: startGrid(), score: 0, won: false, over: false };
}

export function Game2048App(_props: AppWindowProps) {
  const t = useT();
  const [state, setState] = useState<Game2048State>(fresh);
  const [previous, setPrevious] = useState<Game2048State | null>(null);
  const [best, setBest] = useState(() => gamesStore.get().best.game2048 ?? 0);
  const [record, setRecord] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const play = useCallback((direction: Direction) => {
    setState((current) => {
      const { state: next, moved } = applyMove(current, direction);
      if (!moved) return current;
      setPrevious(current);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!state.over) return;
    const isRecord = recordResult('game2048', state.score);
    setRecord(isRecord);
    setBest(gamesStore.get().best.game2048 ?? 0);
  }, [state.over, state.score]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      if (!direction) return;
      // Only react while this window owns the focus.
      const stage = stageRef.current;
      if (!stage || !stage.closest('.window.is-active')) return;
      event.preventDefault();
      play(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  const grid = state.grid;
  const tileClass = (value: number) => (value === 0 ? 'is-empty' : value <= 4 ? `is-${value}` : value <= 64 ? 'is-mid' : value <= 512 ? 'is-high' : 'is-max');

  return (
    <div className="app game g2048">
      <div className="game__bar">
        <div className="game__stats">
          <span className="game__stat">
            <Trophy size={13} /> {state.score}
          </span>
          <span className="game__stat">
            {t('Best')} {best}
          </span>
          <span className="game__stat">
            {t('Top tile')} {bestTile(grid)}
          </span>
        </div>
        <div className="game__bar-actions">
          <button
            className="game__btn"
            onClick={() => {
              if (!previous) return;
              setState(previous);
              setPrevious(null);
            }}
            disabled={!previous}
            title={t('Undo')}
          >
            <Undo2 size={13} /> {t('Undo')}
          </button>
          <button
            className="game__btn"
            onClick={() => {
              setState(fresh());
              setPrevious(null);
              setRecord(false);
              setWinDismissed(false);
            }}
          >
            <RotateCcw size={13} /> {t('New game')}
          </button>
        </div>
      </div>

      <div
        className="game__stage g2048__stage"
        ref={stageRef}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          touchStart.current = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          if (Math.abs(dx) > Math.abs(dy)) play(dx > 0 ? 'right' : 'left');
          else play(dy > 0 ? 'down' : 'up');
        }}
      >
        <div className="g2048__board">
          {grid.map((row, r) =>
            row.map((value, c) => (
              <div key={`${r}-${c}`} className={cn('g2048__tile', tileClass(value))}>
                {value > 0 ? value : ''}
              </div>
            )),
          )}
        </div>

        {(state.over || (state.won && !winDismissed)) && (
          <div className={cn('game__overlay', state.over ? 'is-lose' : 'is-win')}>
            <div className="game__overlay-icon">
              <Trophy size={26} />
            </div>
            <strong>{state.over ? t('No moves left') : t('2048 reached!')}</strong>
            <p>
              {record ? t('New record: {score} points', { score: state.score }) : t('Score: {score}', { score: state.score })}
            </p>
            <div className="row" style={{ gap: 8 }}>
              {state.won && !state.over && (
                <button className="btn" onClick={() => setWinDismissed(true)}>
                  {t('Keep playing')}
                </button>
              )}
              <button
                className="btn btn--primary"
                onClick={() => {
                  setState(fresh());
                  setPrevious(null);
                  setRecord(false);
                }}
              >
                <RotateCcw size={13} /> {t('Play again')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="game__hint">{t('Arrow keys or WASD · swipe on touch screens')}</div>
    </div>
  );
}
