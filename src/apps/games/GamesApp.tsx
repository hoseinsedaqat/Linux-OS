import { AlertTriangle, Bomb, Bug, Grid3x3, Hash, Play, Trophy } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useWindows } from '@/core/window-manager/windowsStore';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { useT } from '@/core/localization/i18n';
import { APP_META } from '@/core/apps/appMeta';
import { AppIcon } from '@/components/common/AppIcon';
import { gamesStore, GAME_LABELS, type GameId } from './gamesStore';

const GAMES: Array<{ id: GameId; appId: 'minesweeper' | 'game2048' | 'snake' | 'tictactoe'; icon: typeof Bomb }> = [
  { id: 'minesweeper', appId: 'minesweeper', icon: Bomb },
  { id: 'game2048', appId: 'game2048', icon: Hash },
  { id: 'snake', appId: 'snake', icon: Bug },
  { id: 'tictactoe', appId: 'tictactoe', icon: Grid3x3 },
];

function formatSeconds(value: number): string {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GamesApp(_props: AppWindowProps) {
  const t = useT();
  const openApp = useWindows((state) => state.openApp);
  const [data] = usePersistedValue(gamesStore);

  return (
    <div className="app games">
      <header className="games__head">
        <div>
          <h2 className="games__title">{t('Games')}</h2>
          <p className="games__sub">
            {t('Four complete games that run entirely in this window — real rules, real scores, no downloads.')}
          </p>
        </div>
        <div className="games__badge">
          <Trophy size={13} /> {t('{count} rounds played', { count: data.played })}
        </div>
      </header>

      <div className="games__grid">
        {GAMES.map(({ id, appId, icon: Icon }) => {
          const meta = APP_META[appId];
          const best =
            id === 'minesweeper'
              ? data.minesBest[data.difficulty] === null
                ? null
                : formatSeconds(data.minesBest[data.difficulty] as number)
              : data.best[id] ?? null;
          return (
            <article key={id} className="games__card" style={{ ['--card-accent' as string]: meta.color }}>
              <div className="games__card-top">
                <AppIcon appId={appId} size="lg" />
                <div className="games__card-title">
                  <strong>{t(GAME_LABELS[id].name)}</strong>
                  <span>{t(GAME_LABELS[id].tagline)}</span>
                </div>
              </div>
              <ul className="games__how">
                {GAME_LABELS[id].howTo.map((line) => (
                  <li key={line}>{t(line)}</li>
                ))}
              </ul>
              <div className="games__card-foot">
                <span className="games__best">
                  <Icon size={12} /> {t('Best')}: {best ?? '—'}
                </span>
                <button className="btn btn--primary btn--sm" onClick={() => openApp(appId)}>
                  <Play size={12} /> {t('Play')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="games__foot">
        <AlertTriangle size={12} />
        {t('High scores are stored in this browser only. The desktop “Games” folder opens each game too.')}
      </div>
    </div>
  );
}
