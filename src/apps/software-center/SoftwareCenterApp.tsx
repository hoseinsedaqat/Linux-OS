import { useMemo, useState } from 'react';
import { Check, Download, Search, Store, Trash2 } from 'lucide-react';
import type { AppId } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { APP_META, APP_CATEGORIES, VISIBLE_APP_IDS } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useT } from '@/core/localization/i18n';
import { notify } from '@/core/notifications/notificationsStore';
import { AppIcon } from '@/components/common/AppIcon';
import { cn } from '@/utils';

export function SoftwareCenterApp(_props: AppWindowProps) {
  const t = useT();
  const installed = useLauncher((state) => state.installed);
  const install = useLauncher((state) => state.install);
  const uninstall = useLauncher((state) => state.uninstall);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All Applications');
  const [activeId, setActiveId] = useState<AppId>('files');
  const [busy, setBusy] = useState<AppId | null>(null);

  const apps = useMemo(() => {
    let list = VISIBLE_APP_IDS;
    if (category !== 'All Applications' && category !== 'Installed') {
      list = list.filter((id) => APP_META[id].category === category);
    }
    if (category === 'Installed') list = list.filter((id) => installed.includes(id));
    if (query.trim()) {
      const term = query.trim().toLowerCase();
      list = list.filter(
        (id) =>
          APP_META[id].name.toLowerCase().includes(term) ||
          APP_META[id].description.toLowerCase().includes(term) ||
          APP_META[id].category.toLowerCase().includes(term),
      );
    }
    return list;
  }, [category, installed, query]);

  const active = APP_META[activeId];
  const isInstalled = installed.includes(activeId);

  const toggleInstall = (appId: AppId) => {
    const currentlyInstalled = installed.includes(appId);
    setBusy(appId);
    window.setTimeout(
      () => {
        if (currentlyInstalled) {
          uninstall(appId);
          notify(`${APP_META[appId].name} ${t('Uninstall')}`, {
            body: t('Removed from the Applications menu (simulated).'),
            appId,
            kind: 'info',
          });
        } else {
          install(appId);
          notify(`${APP_META[appId].name} ${t('Install')}`, {
            body: t('Added to the Applications menu (simulated).'),
            appId,
            kind: 'success',
          });
        }
        setBusy(null);
      },
      480,
    );
  };

  return (
    <div className="app software">
      <div className="app__toolbar">
        <div className="software__search">
          <Search size={14} />
          <input
            className="input"
            placeholder={t('Search apps')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="software__cats">
          {['All Applications', 'Installed', ...APP_CATEGORIES.filter((cat) => !['All Applications', 'Favorites'].includes(cat))].map(
            (cat) => (
              <button
                key={cat}
                className={cn('chip', category === cat && 'is-active')}
                onClick={() => setCategory(cat)}
              >
                {t(cat)}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="software__body">
        <div className="software__list">
          {apps.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <Store size={20} />
              </div>
              <div className="empty-state__title">{t('No apps found')}</div>
            </div>
          ) : (
            apps.map((appId) => {
              const meta = APP_META[appId];
              return (
                <button
                  key={appId}
                  className={cn('software__item', activeId === appId && 'is-active')}
                  onClick={() => setActiveId(appId)}
                >
                  <AppIcon appId={appId} size="md" />
                  <span className="software__item-text">
                    <span className="software__item-name">{t(meta.name)}</span>
                    <span className="software__item-desc">{t(meta.description)}</span>
                  </span>
                  {installed.includes(appId) ? (
                    <span className="badge badge--accent">
                      <Check size={10} /> {t('Installed')}
                    </span>
                  ) : (
                    <span className="badge">{t('Download')}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="software__detail">
          <div className="software__hero" style={{ ['--tile-color' as string]: active.color }}>
            <AppIcon appId={activeId} size="xl" />
            <div>
              <h2 className="software__title">{t(active.name)}</h2>
              <p className="small muted">{t(active.category)} · v1.0.0</p>
            </div>
          </div>
          <p className="software__desc">{t(active.description)}</p>
          <dl className="software__meta">
            <dt>{t('Version')}</dt>
            <dd>1.0.0</dd>
            <dt>{t('Size')}</dt>
            <dd>{(active.defaultSize.width * 3 + 640) / 1000 > 1 ? `${((active.defaultSize.width * 3 + 640) / 1000).toFixed(1)} MB` : '480 KB'}</dd>
            <dt>{t('Category')}</dt>
            <dd>{t(active.category)}</dd>
            <dt>{t('Status')}</dt>
            <dd>{isInstalled ? t('Installed') : t('Not installed')}</dd>
          </dl>
          <div className="software__notice">{t('Install and removal only toggles simulator apps in the Applications menu — no real packages are installed.')}</div>
          <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
            <button
              className={cn('btn', isInstalled ? 'btn--danger' : 'btn--primary')}
              onClick={() => toggleInstall(activeId)}
              disabled={busy === activeId}
            >
              {isInstalled ? <Trash2 size={14} /> : <Download size={14} />}
              {busy === activeId ? t('Loading…') : isInstalled ? t('Uninstall') : t('Install')}
            </button>
            {isInstalled && (
              <button className="btn" onClick={() => useWindows.getState().openApp(activeId)}>
                {t('Open')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
