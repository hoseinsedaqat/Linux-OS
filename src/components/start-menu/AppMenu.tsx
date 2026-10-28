import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Grid2x2,
  History,
  LayoutGrid,
  Lock,
  Power,
  Search,
  Settings2,
  MinusSquare,
  PlusSquare,
  Star,
  StarOff,
  TerminalSquare,
  User,
} from 'lucide-react';
import type { AppId } from '@/types';
import { APP_META, APP_CATEGORIES, VISIBLE_APP_IDS } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { notify } from '@/core/notifications/notificationsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useShell } from '@/core/apps/shellStore';
import { AppIcon } from '@/components/common/AppIcon';
import { useContextMenu } from '@/components/common/ContextMenu';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';

type Category = (typeof APP_CATEGORIES)[number] | 'Recent';

interface AppMenuProps {
  open: boolean;
  onLock: () => void;
  onShutdown: () => void;
}

export function AppMenu({ open, onLock, onShutdown }: AppMenuProps) {
  const t = useT();
  const panelPosition = useSettings((state) => state.panelPosition);
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const installed = useLauncher((state) => state.installed);
  const favorites = useLauncher((state) => state.favorites);
  const desktopApps = useLauncher((state) => state.desktopApps);
  const recent = useLauncher((state) => state.recent);
  const toggleFavorite = useLauncher((state) => state.toggleFavorite);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const [category, setCategory] = useState<Category>('All Applications');
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const menu = useContextMenu();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory('All Applications');
    setFocusIndex(0);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const apps = useMemo(() => {
    const pool = VISIBLE_APP_IDS.filter((id) => installed.includes(id));
    let list = pool;
    if (category === 'Favorites') list = pool.filter((id) => favorites.includes(id));
    else if (category === 'Recent') list = recent.filter((id) => pool.includes(id));
    else if (category !== 'All Applications') list = pool.filter((id) => APP_META[id].category === category);
    if (query.trim()) {
      const term = query.trim().toLowerCase();
      list = pool.filter((id) => {
        const meta = APP_META[id];
        const name = t(meta.name).toLowerCase();
        return (
          name.includes(term) ||
          meta.name.toLowerCase().includes(term) ||
          meta.description.toLowerCase().includes(term) ||
          t(meta.category).toLowerCase().includes(term)
        );
      });
    }
    return list;
  }, [category, favorites, installed, query, recent, t]);

  useEffect(() => {
    setFocusIndex(0);
  }, [query, category]);

  const launch = (appId: AppId) => {
    useWindows.getState().openApp(appId);
    closeOverlays();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex((index) => Math.min(index + 1, apps.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = apps[focusIndex] ?? apps[0];
      if (target) launch(target);
    } else if (event.key === 'Escape') {
      closeOverlays();
    }
  };

  const categories = (['Favorites', 'All Applications', 'Recent', ...APP_CATEGORIES.filter(
    (cat) => cat !== 'Favorites' && cat !== 'All Applications',
  )] as Array<(typeof APP_CATEGORIES)[number] | 'Recent'>).map((cat) => ({
    cat,
    count:
      cat === 'All Applications'
        ? installed.length
        : cat === 'Favorites'
          ? favorites.length
          : cat === 'Recent'
            ? recent.length
            : installed.filter((id) => APP_META[id].category === cat).length,
  }));

  const position = useMemo(() => {
    const thickness = panelPosition === 'top' ? 66 : 58;
    switch (panelPosition) {
      case 'top':
        return { top: thickness, left: 10 };
      case 'left':
        return { left: 96, bottom: 12 };
      case 'right':
        return { right: 96, bottom: 12 };
      default:
        return { bottom: thickness, left: 10 };
    }
  }, [panelPosition]);

  const sectionTitle =
    category === 'All Applications'
      ? query
        ? `${t('Search')}: ${query}`
        : t('All Applications')
      : query
        ? `${t('Search')}: ${query}`
        : t(category);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="appmenu-layer" key="appmenu-layer">
          {/* This click-catcher must stay BELOW .appmenu (z-index 7800);
              any higher and it swallows every hover and click inside the
              menu, including the power actions in the footer. */}
          <motion.div
            key="appmenu-backdrop"
            className="appmenu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={closeOverlays}
            style={{ position: 'fixed', inset: 0, zIndex: 7700 }}
          />
          <motion.div
            key="appmenu-panel"
            className="appmenu"
            style={position}
            role="dialog"
            aria-label={t('Applications')}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: panelPosition === 'top' ? -10 : 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: panelPosition === 'top' ? -8 : 10, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={handleKeyDown}
          >
            <div className="appmenu__top">
              <div className="appmenu__search">
                <span className="appmenu__search-icon">
                  <Search size={15} />
                </span>
                <input
                  ref={searchRef}
                  className="input"
                  placeholder={t('Type to search apps…')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={t('Search applications')}
                />
                <span className="appmenu__search-kbd">
                  <span className="kbd">↵</span>
                </span>
              </div>
              <button
                className="icon-btn"
                title={t('Terminal')}
                onClick={() => {
                  useWindows.getState().openApp('terminal');
                  closeOverlays();
                }}
              >
                <TerminalSquare size={16} />
              </button>
            </div>

            <div className="appmenu__body">
              <nav className="appmenu__sidebar" aria-label={t('Category')}>
                {categories.map(({ cat, count }) => (
                  <button
                    key={cat}
                    className={cn('appmenu__nav', category === cat && 'is-active')}
                    onClick={() => setCategory(cat as Category)}
                  >
                    {cat === 'All Applications' ? (
                      <LayoutGrid size={15} />
                    ) : cat === 'Favorites' ? (
                      <Star size={15} />
                    ) : cat === 'Recent' ? (
                      <History size={15} />
                    ) : (
                      <Grid2x2 size={15} />
                    )}
                    <span className="truncate">{t(cat)}</span>
                    <span className="appmenu__nav-count">{count}</span>
                  </button>
                ))}
              </nav>

              <div className="appmenu__content">
                <div className="appmenu__section-title">
                  <span>{sectionTitle}</span>
                  <span className="tiny faint">{apps.length}</span>
                </div>
                {apps.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <Search size={20} />
                    </div>
                    <div className="empty-state__title">
                      {query ? t('No results for "{query}"', { query }) : t('No items')}
                    </div>
                    <div className="small">{query ? t('Try a different search term or category.') : t('All Applications')}</div>
                  </div>
                ) : (
                  <div className="appmenu__grid">
                    {apps.map((appId, index) => {
                      const meta = APP_META[appId];
                      const isPinned = favorites.includes(appId);
                      const onDesktop = desktopApps.includes(appId);
                      return (
                        <button
                          key={appId}
                          className={cn('app-tile-btn', index === focusIndex && 'is-focused')}
                          onMouseEnter={() => setFocusIndex(index)}
                          onClick={() => launch(appId)}
                          onContextMenu={(event) =>
                            menu.open(event, [
                              { id: 'open', label: `${t('Open')} ${t(meta.name)}`, onClick: () => launch(appId) },
                              {
                                id: 'pin',
                                label: isPinned ? t('Unpin') : t('Pin'),
                                icon: isPinned ? StarOff : Star,
                                onClick: () => toggleFavorite(appId),
                              },
                              {
                                id: 'desktop',
                                label: onDesktop ? t('Remove from Desktop') : t('Add to Desktop'),
                                icon: onDesktop ? MinusSquare : PlusSquare,
                                onClick: () => {
                                  useLauncher.getState().toggleDesktop(appId);
                                  notify(
                                    onDesktop ? t('Removed from Desktop') : t('Added to Desktop'),
                                    { body: t(meta.name), kind: onDesktop ? 'info' : 'success' },
                                  );
                                },
                              },
                              {
                                id: 'new',
                                label: t('Open in new window'),
                                disabled: Boolean(meta.singleton),
                                onClick: () => {
                                  useWindows.getState().openApp(appId, undefined, { forceNew: true });
                                  closeOverlays();
                                },
                              },
                            ])
                          }
                        >
                          <AppIcon appId={appId} size="lg" />
                          <span className="app-tile-btn__text">
                            <span className="app-tile-btn__name">{t(meta.name)}</span>
                            <span className="app-tile-btn__desc">{t(meta.description)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <footer className="appmenu__footer">
              <button
                className="qs__user"
                onClick={() => {
                  closeOverlays();
                  useWindows.getState().openApp('settings', { section: 'about' });
                }}
                style={{ padding: '2px 4px', borderRadius: 8 }}
                title={t('About this simulator')}
              >
                <span className="panel__avatar"><User size={12} /></span>
                <span>{t('Demo User')}</span>
              </button>
              <div className="appmenu__footer-actions">
                <button
                  className="icon-btn"
                  title={t('Settings')}
                  onClick={() => {
                    useWindows.getState().openApp('settings');
                    closeOverlays();
                  }}
                >
                  <Settings2 size={16} />
                </button>
                <button className="icon-btn" title={t('Lock Screen')} onClick={onLock}>
                  <Lock size={16} />
                </button>
                <button
                  className="icon-btn"
                  title={t('Power Off')}
                  onClick={() => {
                    closeOverlays();
                    onShutdown();
                  }}
                >
                  <Power size={16} />
                </button>
              </div>
            </footer>
          </motion.div>
        </div>
      )}
      {menu.node}
    </AnimatePresence>,
    document.body,
  );
}
