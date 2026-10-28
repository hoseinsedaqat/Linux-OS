import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, BellOff, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { NotificationItem } from '@/types';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { EmptyState } from '@/components/common/Controls';
import { cn, relativeTime } from '@/utils';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface NotificationCenterProps {
  open: boolean;
  style: React.CSSProperties;
  onClose: () => void;
}

export function NotificationCenter({ open, style, onClose }: NotificationCenterProps) {
  const t = useT();
  const items = useNotifications((state) => state.items);
  const dismiss = useNotifications((state) => state.dismiss);
  const clearAll = useNotifications((state) => state.clearAll);
  const markAllRead = useNotifications((state) => state.markAllRead);
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const dnd = useSettings((state) => state.dnd);
  const language = useSettings((state) => state.language);
  const enabled = useSettings((state) => state.notificationsEnabled);
  const openApp = useWindows((state) => state.openApp);
  const closeOverlays = useShell((state) => state.closeOverlays);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => markAllRead(), 800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, markAllRead]);

  if (typeof document === 'undefined') return null;

  const openTarget = (item: NotificationItem) => {
    if (item.appId) openApp(item.appId);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 8400 }} onMouseDown={closeOverlays} />
          <motion.div
            className="popover"
            style={{ ...style, width: 372, zIndex: 8500 }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={t('Notifications')}
          >
            <div className="popover__header">
              <div className="row" style={{ gap: 8 }}>
                <Bell size={15} style={{ color: 'var(--accent)' }} />
                <span className="popover__title">{t('Notifications')}</span>
                {(dnd || !enabled) && (
                  <span className="badge badge--warning">
                    <BellOff size={10} /> {t('Do Not Disturb')}
                  </span>
                )}
              </div>
              <button className="btn btn--sm btn--ghost" onClick={clearAll} disabled={items.length === 0}>
                {t('Clear all')}
              </button>
            </div>
            <div className="popover__scroll" style={{ maxHeight: 400 }}>
              {items.length === 0 ? (
                <EmptyState icon={Bell} title={t('No new notifications')} description={t('You are all caught up.')} compact />
              ) : (
                items.map((item) => {
                  const Icon = ICONS[item.kind];
                  return (
                    <div key={item.id} className="notif">
                      <span className={cn('notif__icon', `notif__icon--${item.kind}`)}>
                        <Icon size={14} />
                      </span>
                      <button
                        className="notif__body"
                        style={{ textAlign: 'start', background: 'none' }}
                        onClick={() => openTarget(item)}
                      >
                        <span className="notif__title">{item.title}</span>
                        {item.body && <span className="notif__text">{item.body}</span>}
                        <span className="notif__time">{relativeTime(item.createdAt, language)}</span>
                      </button>
                      <button className="icon-btn notif__close" onClick={() => dismiss(item.id)} aria-label={t('Close')}>
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
