import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '@/core/themes/settingsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useShell } from '@/core/apps/shellStore';
import { useT } from '@/core/localization/i18n';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { calendarStore } from '@/apps/calendar/calendarStore';
import { formatLocalizedDate } from '@/core/localization/i18n';
import { cn } from '@/utils';

interface CalendarPopoverProps {
  open: boolean;
  style: React.CSSProperties;
  onClose: () => void;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CalendarPopover({ open, style, onClose }: CalendarPopoverProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const reduceMotion = useSettings((state) => state.reduceMotion);
  const openApp = useWindows((state) => state.openApp);
  const closeOverlays = useShell((state) => state.closeOverlays);
  const [events] = usePersistedValue(calendarStore);
  const [month, setMonth] = useState(() => new Date());

  if (typeof document === 'undefined') return null;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  const todayIso = isoDate(new Date());
  const cells: Array<{ day: number; muted: boolean; date: Date }> = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    cells.push({ day: prevMonthDays - i, muted: true, date: new Date(year, monthIndex - 1, prevMonthDays - i) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, muted: false, date: new Date(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({ day: nextDay, muted: true, date: new Date(year, monthIndex + 1, nextDay) });
  }

  const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  if (language === 'fa') {
    dow.splice(0, 7, 'ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش');
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 8400 }} onMouseDown={closeOverlays} />
          <motion.div
            className="popover"
            style={{ ...style, zIndex: 8500 }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={t('Calendar')}
          >
            <div className="popover__header">
              <div className="row" style={{ gap: 8 }}>
                <CalendarDays size={15} style={{ color: 'var(--accent)' }} />
                <span className="popover__title">
                  {formatLocalizedDate(firstDay, language, { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">
                  <ChevronLeft size={15} />
                </button>
                <button className="icon-btn" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Next month">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div className="cal">
              <div className="cal__grid">
                {dow.map((day, index) => (
                  <div key={`${day}-${index}`} className="cal__dow">
                    {day}
                  </div>
                ))}
                {cells.map((cell, index) => {
                  const iso = isoDate(cell.date);
                  const hasEvent = events.some((event) => event.date === iso);
                  return (
                    <button
                      key={`${iso}-${index}`}
                      className={cn(
                        'cal__day',
                        cell.muted && 'cal__day--muted',
                        iso === todayIso && 'cal__day--today',
                        hasEvent && 'cal__day--has-event',
                      )}
                      onClick={() => {
                        openApp('calendar', { date: iso });
                        onClose();
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => {
                  openApp('calendar');
                  onClose();
                }}
              >
                {t('Open')} {t('Calendar')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
