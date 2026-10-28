import { useState } from 'react';
import { RotateCcw, User, Users, Trophy } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';
import {
  computerMove,
  createBoard,
  isDraw,
  winnerOf,
  type Board,
  type Level,
  type Mark,
} from './logic/tictactoe';
import { gamesStore, recordResult } from './gamesStore';

export function TicTacToeApp(_props: AppWindowProps) {
  const t = useT();
  const [level, setLevel] = useState<Level>(() => gamesStore.get().level);
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<Mark>('X');
  const [thinking, setThinking] = useState(false);
  const [tally, setTally] = useState({ wins: 0, losses: 0, draws: 0 });
  const [record, setRecord] = useState(false);

  const winner = winnerOf(board);
  const draw = isDraw(board);
  const finished = Boolean(winner) || draw;

  const reset = () => {
    setBoard(createBoard());
    setTurn('X');
    setThinking(false);
    setRecord(false);
  };

  const settle = (result: 'win' | 'loss' | 'draw') => {
    setTally((current) => ({
      wins: current.wins + (result === 'win' ? 1 : 0),
      losses: current.losses + (result === 'loss' ? 1 : 0),
      draws: current.draws + (result === 'draw' ? 1 : 0),
    }));
    if (result !== 'loss') setRecord(recordResult('tictactoe', result === 'win' ? 3 : 1));
  };

  const play = (index: number) => {
    if (finished || thinking || board[index] !== null) return;
    const next = [...board];
    next[index] = turn;
    setBoard(next);
    const win = winnerOf(next);
    if (win) {
      settle(win.mark === 'X' ? 'win' : 'loss');
      return;
    }
    if (isDraw(next)) {
      settle('draw');
      return;
    }
    setTurn(turn === 'X' ? 'O' : 'X');
    if (!twoPlayers && turn === 'X') {
      setThinking(true);
      window.setTimeout(() => {
        const move = computerMove(next, 'O', level);
        if (move === null) return;
        const after = [...next];
        after[move] = 'O';
        setBoard(after);
        setThinking(false);
        const winAfter = winnerOf(after);
        if (winAfter) settle('loss');
        else if (isDraw(after)) settle('draw');
        else setTurn('X');
      }, 320);
    }
  };

  return (
    <div className="app game ttt">
      <div className="game__bar">
        <div className="game__stats">
          <span className="game__stat">
            <Trophy size={13} /> {tally.wins} · {t('draws')} {tally.draws} · {t('losses')} {tally.losses}
          </span>
        </div>
        <div className="game__bar-actions">
          <button
            className={cn('game__chip', twoPlayers && 'is-active')}
            onClick={() => {
              setTwoPlayers((value) => !value);
              reset();
            }}
            title={t('Play with a friend on this screen')}
          >
            {twoPlayers ? <Users size={12} /> : <User size={12} />}
            {twoPlayers ? t('Two players') : t('vs computer')}
          </button>
          {!twoPlayers &&
            (['easy', 'medium', 'hard'] as Level[]).map((option) => (
              <button
                key={option}
                className={cn('game__chip', level === option && 'is-active')}
                onClick={() => {
                  setLevel(option);
                  gamesStore.set((current) => ({ ...current, level: option }));
                  reset();
                }}
              >
                {t(option === 'easy' ? 'Easy' : option === 'medium' ? 'Medium' : 'Hard')}
              </button>
            ))}
          <button className="game__btn" onClick={reset}>
            <RotateCcw size={13} /> {t('New game')}
          </button>
        </div>
      </div>

      <div className="game__stage ttt__stage">
        <div className={cn('ttt__board', winner && 'has-winner')}>
          {board.map((cell, index) => (
            <button
              key={index}
              className={cn(
                'ttt__cell',
                cell && `is-${cell.toLowerCase()}`,
                winner?.line.includes(index) && 'is-winning',
              )}
              onClick={() => play(index)}
              disabled={Boolean(cell) || finished}
              aria-label={cell ? `${t('Cell')} ${index + 1}: ${cell}` : `${t('Cell')} ${index + 1}`}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="ttt__status">
          {winner ? (
            <strong>
              {winner.mark === 'X' ? (twoPlayers ? t('X wins!') : t('You win!')) : twoPlayers ? t('O wins!') : t('Computer wins')}
              {record && winner.mark === 'X' && <span className="ttt__record"> · {t('new record')}</span>}
            </strong>
          ) : draw ? (
            <strong>{t('It is a draw')}</strong>
          ) : (
            <span>
              {twoPlayers
                ? t('Turn: {mark}', { mark: turn })
                : thinking
                  ? t('The computer is thinking…')
                  : t('Your turn — you are X')}
            </span>
          )}
        </div>
      </div>

      <div className="game__hint">
        {twoPlayers ? t('Two players share this screen.') : t('The hard level plays perfectly — a draw is the best you can get.')}
      </div>
    </div>
  );
}
