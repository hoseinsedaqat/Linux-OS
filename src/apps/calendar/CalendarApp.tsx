import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, Download, Plus, Trash2, CalendarDays, Upload } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { EVENT_COLORS, addEvent, calendarStore, deleteEvent, eventsOn, fromIcs, toIcs } from './calendarStore';
import { notify, notifySuccess } from '@/core/notifications/notificationsStore';
import { downloadBlob } from '@/utils';
import { EmptyState } from '@/components/common/Controls';
import { cn } from '@/utils';
import { formatLocalizedDate } from '@/core/localization/i18n';

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CalendarApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const [events] = usePersistedValue(calendarStore);
  const [cursor, setCursor] = useState(() => {
    if (win.payload?.date) {
      const [year, month, day] = win.payload.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => win.payload?.date ?? iso(new Date()));
  const [form, setForm] = useState({
    title: '',
    time: '09:00',
    color: EVENT_COLORS[0],
    notes: '',
    repeat: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    remindMinutes: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells = useMemo(() => {
    const list: Array<{ date: Date; muted: boolean }> = [];
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      list.push({ date: new Date(year, monthIndex - 1, prevMonthDays - i), muted: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push({ date: new Date(year, monthIndex, day), muted: false });
    }
    while (list.length % 7 !== 0) {
      const nextDay = list.length - (startWeekday + daysInMonth) + 1;
      list.push({ date: new Date(year, monthIndex + 1, nextDay), muted: true });
    }
    return list;
  }, [year, monthIndex, startWeekday, daysInMonth, prevMonthDays]);

  useEffect(() => {
    if (win.payload?.date) {
      setSelectedDate(win.payload.date);
      const [y, m, d] = win.payload.date.split('-').map(Number);
      setCursor(new Date(y, m - 1, d));
    }
  }, [win.payload?.date]);

  const selectedEvents = eventsOn(events, selectedDate);

  const add = () => {
    if (!form.title.trim()) {
      setError(t('Name cannot be empty'));
      return;
    }
    addEvent({
      title: form.title.trim(),
      date: selectedDate,
      time: form.time,
      color: form.color,
      notes: form.notes.trim() || undefined,
      repeat: form.repeat,
      remindMinutes: form.remindMinutes || undefined,
    });
    setForm({ title: '', time: '09:00', color: EVENT_COLORS[0], notes: '', repeat: 'none', remindMinutes: 0 });
    setError(null);
  };

  /* Reminders: checked every 30 s while the app is open, for today's events. */
  useEffect(() => {
    const fired = new Set<string>();
    const check = () => {
      const today = iso(new Date());
      const now = Date.now();
      for (const event of eventsOn(events, today)) {
        if (!event.remindMinutes || !event.time) continue;
        const key = `${event.id}-${today}`;
        if (fired.has(key)) continue;
        const at = new Date(`${today}T${event.time}:00`).getTime() - event.remindMinutes * 60_000;
        if (at <= now && now - at < 5 * 60_000) {
          fired.add(key);
          notify(t('Reminder'), { body: `${event.time} · ${event.title}`, kind: 'info' });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(event.title, { body: `${event.time} · ${t('Reminder')}` });
            } catch {
              /* the in-app notification already covered it */
            }
          }
        }
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, [events, t]);

  const exportIcs = () => {
    downloadBlob('nova-calendar.ics', new Blob([toIcs(events)], { type: 'text/calendar' }));
    notifySuccess(t('Exported'), 'nova-calendar.ics');
  };

  const importIcs = async (file: File) => {
    const parsed = fromIcs(await file.text());
    if (parsed.length === 0) {
      notify(t('No events found in that file'), { kind: 'warning' });
      return;
    }
    parsed.forEach((event) => addEvent(event));
    notifySuccess(t('Imported {n} events', { n: parsed.length }), file.name);
  };

  const enableReminders = async () => {
    if (typeof Notification === 'undefined') {
      notify(t('This browser does not support system notifications'), { kind: 'warning' });
      return;
    }
    const result = await Notification.requestPermission();
    notify(
      result === 'granted' ? t('System reminders enabled') : t('Permission denied — reminders stay inside NOVA'),
      { kind: result === 'granted' ? 'success' : 'warning' },
    );
  };

  const dow = language === 'fa' ? ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="app calendar-app">
      <div className="calendar-app__main">
        <div className="app__toolbar">
          <button className="icon-btn" onClick={() => setCursor(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn" onClick={() => setCursor(new Date(year, monthIndex + 1, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <strong style={{ fontSize: 15, minWidth: 170 }}>
            {formatLocalizedDate(firstDay, language, { month: 'long', year: 'numeric' })}
          </strong>
          <button
            className="btn btn--sm"
            onClick={() => {
              setCursor(new Date());
              setSelectedDate(iso(new Date()));
            }}
          >
            {t('Today')}
          </button>
          <span className="grow" />
          <span className="tiny faint">{events.length} {t('Events')}</span>
          <button className="icon-btn" onClick={exportIcs} title={t('Export as .ics')} aria-label={t('Export as .ics')}>
            <Download size={14} />
          </button>
          <label className="icon-btn" title={t('Import an .ics file')} aria-label={t('Import an .ics file')}>
            <Upload size={14} />
            <input
              type="file"
              accept=".ics,text/calendar"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importIcs(file);
                event.target.value = '';
              }}
            />
          </label>
          <button className="icon-btn" onClick={() => void enableReminders()} title={t('Enable system reminders')} aria-label={t('Enable system reminders')}>
            <Bell size={14} />
          </button>
        </div>

        <div className="calendar-app__grid">
          {dow.map((day, index) => (
            <div key={`${day}-${index}`} className="calendar-app__dow">
              {day}
            </div>
          ))}
          {cells.map(({ date, muted }, index) => {
            const key = iso(date);
            const dayEvents = events.filter((event) => event.date === key);
            return (
              <button
                key={`${key}-${index}`}
                className={cn(
                  'calendar-app__cell',
                  muted && 'is-muted',
                  key === iso(new Date()) && 'is-today',
                  key === selectedDate && 'is-selected',
                )}
                onClick={() => setSelectedDate(key)}
                onDoubleClick={() => {
                  setSelectedDate(key);
                  setForm((current) => ({ ...current, title: '' }));
                }}
              >
                <span className="calendar-app__cell-day">{date.getDate()}</span>
                <span className="calendar-app__cell-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span key={event.id} className="calendar-app__chip" style={{ background: event.color }}>
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="tiny faint">+{dayEvents.length - 3}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="calendar-app__side">
        <div className="calendar-app__side-head">
          <CalendarDays size={15} style={{ color: 'var(--accent)' }} />
          <strong className="small">
            {formatLocalizedDate(new Date(`${selectedDate}T12:00:00`), language, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </strong>
        </div>

        <div className="calendar-app__events">
          {selectedEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title={t('No events')} compact />
          ) : (
            selectedEvents.map((event) => (
              <div key={event.id} className="calendar-app__event">
                <span className="calendar-app__event-dot" style={{ background: event.color }} />
                <div className="grow">
                  <div className="calendar-app__event-title">{event.title}</div>
                  <div className="tiny faint">
                    {event.time ?? ''} {event.notes ? `· ${event.notes}` : ''}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => deleteEvent(event.id)} title={t('Delete event')}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="calendar-app__form">
          <div className="field">
            <label className="field__label" htmlFor="event-title">
              {t('Event title')}
            </label>
            <input
              id="event-title"
              className={cn('input', error && 'input--error')}
              value={form.title}
              onChange={(event) => {
                setForm((current) => ({ ...current, title: event.target.value }));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add();
              }}
              placeholder={t('Event title')}
            />
            {error && <span className="field__error">{error}</span>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="time"
              className="input"
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              aria-label={t('Time')}
            />
            <div className="row" style={{ gap: 4 }}>
              {EVENT_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn('notes__color', form.color === color && 'is-active')}
                  style={{ background: color }}
                  onClick={() => setForm((current) => ({ ...current, color }))}
                  aria-label={t('Note color')}
                />
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select
              className="select"
              value={form.repeat}
              onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value as typeof form.repeat }))}
              aria-label={t('Repeat')}
            >
              <option value="none">{t('Does not repeat')}</option>
              <option value="daily">{t('Daily')}</option>
              <option value="weekly">{t('Weekly')}</option>
              <option value="monthly">{t('Monthly')}</option>
            </select>
            <select
              className="select"
              value={form.remindMinutes}
              onChange={(event) => setForm((current) => ({ ...current, remindMinutes: Number(event.target.value) }))}
              aria-label={t('Reminder')}
            >
              <option value={0}>{t('No reminder')}</option>
              <option value={5}>{t('5 minutes before')}</option>
              <option value={15}>{t('15 minutes before')}</option>
              <option value={60}>{t('1 hour before')}</option>
            </select>
          </div>
          <button className="btn btn--primary btn--sm" onClick={add}>
            <Plus size={14} /> {t('Add event')}
          </button>
        </div>
      </aside>
    </div>
  );
}
