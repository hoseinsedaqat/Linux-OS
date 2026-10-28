import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';
import { createSnake, speedFor, tick, turn, type Heading, type SnakeState } from './logic/snake';
import { gamesStore, recordResult } from './gamesStore';

export function SnakeApp(_props: AppWindowProps) {
  const t = useT();
  const [state, setState] = useState<SnakeState>(() => createSnake());
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<'calm' | 'normal' | 'fast'>(() => gamesStore.get().snakeSpeed);
  const [best, setBest] = useState(() => gamesStore.get().best.snake ?? 0);
  const [record, setRecord] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const baseSpeed = speed === 'calm' ? 190 : speed === 'fast' ? 110 : 150;

  const restart = useCallback(() => {
    setState(createSnake());
    setPaused(false);
    setRecord(false);
  }, []);

  const steer = useCallback((heading: Heading) => {
    setState((current) => turn(current, heading));
  }, []);

  useEffect(() => {
    if (!state.alive || paused) return;
    const timer = window.setTimeout(() => setState((current) => tick(current)), speedFor(state.score, baseSpeed));
    return () => window.clearTimeout(timer);
  }, [state, paused, baseSpeed]);

  useEffect(() => {
    if (state.alive) return;
    if (state.score === 0 && !state.won) return;
    const isRecord = recordResult('snake', state.score);
    setRecord(isRecord);
    setBest(gamesStore.get().best.snake ?? 0);
  }, [state.alive, state.score, state.won]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const stage = stageRef.current;
      if (!stage || !stage.closest('.window.is-active')) return;
      const map: Record<string, Heading> = {
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
      if (map[event.key]) {
        event.preventDefault();
        steer(map[event.key]);
      } else if (event.key === ' ') {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key === 'r' || event.key === 'R') {
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steer, restart]);

  const cellStyle = { gridTemplateColumns: `repeat(${state.cols}, 1fr)`, gridTemplateRows: `repeat(${state.rows}, 1fr)` };
  const bodyIndex = (x: number, y: number) => state.snake.findIndex((segment) => segment.x === x && segment.y === y);
  const isHead = (x: number, y: number) => state.snake[0]?.x === x && state.snake[0]?.y === y;

  return (
    <div className="app game snake">
      <div className="game__bar">
        <div className="game__stats">
          <span className="game__stat">
            <Trophy size={13} /> {state.score}
          </span>
          <span className="game__stat">
            {t('Best')} {best}
          </span>
        </div>
        <div className="game__bar-actions">
          {(['calm', 'normal', 'fast'] as const).map((option) => (
            <button
              key={option}
              className={cn('game__chip', speed === option && 'is-active')}
              onClick={() => {
                setSpeed(option);
                gamesStore.set((current) => ({ ...current, snakeSpeed: option }));
              }}
            >
              {t(option === 'calm' ? 'Calm' : option === 'normal' ? 'Normal' : 'Fast')}
            </button>
          ))}
          <button className="game__btn" onClick={() => setPaused((value) => !value)}>
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? t('Resume') : t('Pause')}
          </button>
          <button className="game__btn" onClick={restart}>
            <RotateCcw size={13} /> {t('New game')}
          </button>
        </div>
      </div>

      <div
        className="game__stage snake__stage"
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
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
          if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
          else steer(dy > 0 ? 'down' : 'up');
        }}
      >
        <div className="snake__grid" style={cellStyle}>
          {Array.from({ length: state.cols * state.rows }, (_, index) => {
            const x = index % state.cols;
            const y = Math.floor(index / state.cols);
            const body = bodyIndex(x, y);
            const food = state.food.x === x && state.food.y === y;
            return (
              <span
                key={index}
                className={cn(
                  'snake__cell',
                  body >= 0 && 'is-body',
                  isHead(x, y) && 'is-head',
                  food && 'is-food',
                )}
              />
            );
          })}
        </div>

        {(!state.alive || paused) && (
          <div className={cn('game__overlay', state.won ? 'is-win' : state.alive ? '' : 'is-lose')}>
            <div className="game__overlay-icon">{paused ? <Pause size={24} /> : <Trophy size={24} />}</div>
            <strong>
              {paused ? t('Paused') : state.won ? t('Perfect game!') : t('Game over')}
            </strong>
            <p>
              {paused
                ? t('Press Space or Resume to continue.')
                : record
                  ? t('New record: {score} points', { score: state.score })
                  : t('Score: {score}', { score: state.score })}
            </p>
            {paused ? (
              <button className="btn btn--primary" onClick={() => setPaused(false)}>
                <Play size={13} /> {t('Resume')}
              </button>
            ) : (
              <button className="btn btn--primary" onClick={restart}>
                <RotateCcw size={13} /> {t('Play again')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="game__hint snake__controls">
        <span>
          <ArrowUp size={12} /> <ArrowDown size={12} /> <ArrowLeft size={12} /> <ArrowRight size={12} /> {t('or WASD to steer')} ·{' '}
          {t('Space pauses')}
        </span>
        <span className="snake__dpad">
          <button className="game__chip" onClick={() => steer('up')} aria-label={t('Up')}>
            <ArrowUp size={12} />
          </button>
          <button className="game__chip" onClick={() => steer('left')} aria-label={t('Left')}>
            <ArrowLeft size={12} />
          </button>
          <button className="game__chip" onClick={() => steer('down')} aria-label={t('Down')}>
            <ArrowDown size={12} />
          </button>
          <button className="game__chip" onClick={() => steer('right')} aria-label={t('Right')}>
            <ArrowRight size={12} />
          </button>
        </span>
      </div>
    </div>
  );
}
