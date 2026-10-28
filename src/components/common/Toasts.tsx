import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { useSettings } from '@/core/themes/settingsStore';
import type { NotificationItem } from '@/types';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastRow({ item }: { item: NotificationItem }) {
  const dismiss = useNotifications((state) => state.dismissToast);
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const Icon = ICONS[item.kind];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), 4800);
    return () => window.clearTimeout(timer);
  }, [dismiss, item.id]);

  return (
    <motion.div
      className="toast"
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role="status"
    >
      <span className="toast__icon">
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="toast__body">
        <div className="toast__title">{item.title}</div>
        {item.body && <div className="toast__text">{item.body}</div>}
      </div>
      <button className="icon-btn" onClick={() => dismiss(item.id)} aria-label="Dismiss">
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useNotifications((state) => state.toasts);
  const panelPosition = useSettings((state) => state.panelPosition);
  const layoutClass =
    panelPosition === 'top' ? 'toast-stack--br' : panelPosition === 'left' ? 'toast-stack--br' : 'toast-stack--tr';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`toast-stack ${layoutClass}`} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
