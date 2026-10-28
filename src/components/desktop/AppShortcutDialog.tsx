import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { AppId } from '@/types';
import { APP_META, APP_IDS } from '@/core/apps/appMeta';
import { useLauncher } from '@/core/apps/launcherStore';
import { AppIcon } from '@/components/common/AppIcon';
import { Modal } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { notify, notifyError } from '@/core/notifications/notificationsStore';
import { cn } from '@/utils';

interface AppShortcutDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Add app shortcut" picker. Every entry is a real application that can be
 * launched, so the button can never create a dead icon on the desktop.
 */
export function AppShortcutDialog({ open, onClose }: AppShortcutDialogProps) {
  const t = useT();
  const installed = useLauncher((state) => state.installed);
  const desktopApps = useLauncher((state) => state.desktopApps);
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const ids = APP_IDS.filter((id) => !APP_META[id].hidden && installed.includes(id));
    const needle = query.trim().toLowerCase();
    if (!needle) return ids;
    return ids.filter((id) => {
      const meta = APP_META[id];
      return (
        t(meta.name).toLowerCase().includes(needle) ||
        t(meta.description).toLowerCase().includes(needle) ||
        meta.category.toLowerCase().includes(needle)
      );
    });
  }, [installed, query, t]);

  const add = (id: AppId) => {
    const store = useLauncher.getState();
    if (store.desktopApps.includes(id)) {
      store.removeFromDesktop(id);
      notify(t('Removed from Desktop'), { body: t(APP_META[id].name), kind: 'info' });
      return;
    }
    store.addToDesktop(id);
    notify(t('Added to Desktop'), { body: t(APP_META[id].name), kind: 'success' });
  };

  return (
    <Modal open={open} title={t('Add app shortcut')} onClose={onClose}>
      <div className="shortcut-dialog">
        <label className="shortcut-dialog__search">
          <Search size={14} />
          <input
            className="input"
            placeholder={t('Search applications')}
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('Search applications')}
          />
        </label>

        <div className="shortcut-dialog__list">
          {available.length === 0 && (
            <p className="shortcut-dialog__empty">{t('No applications match your search.')}</p>
          )}
          {available.map((id) => {
            const meta = APP_META[id];
            const onDesktop = desktopApps.includes(id);
            return (
              <button
                key={id}
                className={cn('shortcut-row', onDesktop && 'is-added')}
                onClick={() => add(id)}
                aria-pressed={onDesktop}
              >
                <AppIcon appId={id} size="md" />
                <span className="shortcut-row__text">
                  <span className="shortcut-row__name">{t(meta.name)}</span>
                  <span className="shortcut-row__desc">{t(meta.description)}</span>
                </span>
                <span className={cn('shortcut-row__action', onDesktop && 'is-on')}>
                  {onDesktop ? <Check size={14} /> : <Plus size={14} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="shortcut-dialog__footer">
          <span className="tiny faint">{t('Icons are stored in this browser.')}</span>
          <button
            className="btn btn--sm"
            onClick={() => {
              useLauncher.getState().resetDesktop();
              notifyError(t('Desktop icons restored'), t('Default set'));
            }}
          >
            {t('Restore default icons')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
