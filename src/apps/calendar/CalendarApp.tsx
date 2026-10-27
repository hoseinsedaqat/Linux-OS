import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { EVENT_COLORS, addEvent, calendarStore, deleteEvent } from './calendarStore';
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
  const [form, setForm] = useState({ title: '', time: '09:00', color: EVENT_COLORS[0], notes: '' });
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

  const selectedEvents = events
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

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
    });
    setForm({ title: '', time: '09:00', color: EVENT_COLORS[0], notes: '' });
    setError(null);
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
          <button className="btn btn--primary btn--sm" onClick={add}>
            <Plus size={14} /> {t('Add event')}
          </button>
        </div>
      </aside>
    </div>
  );
}
