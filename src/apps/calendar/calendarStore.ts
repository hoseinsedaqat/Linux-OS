import type { CalendarEvent } from '@/types';
import { PersistedValue } from '@/core/persistence/kvStore';
import { uid } from '@/utils';

export const calendarStore = new PersistedValue<CalendarEvent[]>('app.calendar.events', []);

export function addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
  const created: CalendarEvent = { ...event, id: uid('evt') };
  calendarStore.set((current) => [...current, created]);
  return created;
}

export function updateEvent(id: string, patch: Partial<CalendarEvent>): void {
  calendarStore.set((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
}

export function deleteEvent(id: string): void {
  calendarStore.set((current) => current.filter((event) => event.id !== id));
}

export const EVENT_COLORS = ['#3ddc97', '#5aa9ff', '#ff9250', '#a586ff', '#ff7a90', '#f2b64c'];

/** Does this event happen on the given yyyy-mm-dd, counting its recurrence? */
export function occursOn(event: CalendarEvent, date: string): boolean {
  if (event.date === date) return true;
  if (!event.repeat || event.repeat === 'none') return false;
  if (date < event.date) return false;
  const start = new Date(`${event.date}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  switch (event.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return start.getDay() === target.getDay();
    case 'monthly':
      return start.getDate() === target.getDate();
    default:
      return false;
  }
}

/** Events for one day, recurrence included, sorted by time. */
export function eventsOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events
    .filter((event) => occursOn(event, date))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}

const ICS_DATE = (date: string, time?: string) => `${date.replace(/-/g, '')}T${(time ?? '09:00').replace(':', '')}00`;

/** Serialise the calendar as a standard iCalendar (RFC 5545) file. */
export function toIcs(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NOVA Linux//Calendar//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@nova.local`);
    lines.push(`DTSTAMP:${ICS_DATE(event.date, event.time)}`);
    lines.push(`DTSTART:${ICS_DATE(event.date, event.time)}`);
    lines.push('DURATION:PT1H');
    lines.push(`SUMMARY:${event.title.replace(/[\n,;]/g, ' ')}`);
    if (event.notes) lines.push(`DESCRIPTION:${event.notes.replace(/[\n,;]/g, ' ')}`);
    if (event.repeat && event.repeat !== 'none') {
      lines.push(`RRULE:FREQ=${event.repeat.toUpperCase()}`);
    }
    if (event.remindMinutes) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT' + event.remindMinutes + 'M', 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Parse the VEVENT blocks of an iCalendar file. Unknown properties are ignored,
 * and a block without a start date is skipped rather than guessed.
 */
export function fromIcs(text: string): Array<Omit<CalendarEvent, 'id'>> {
  const unfolded = text.replace(/\r\n[ \t]/g, '');
  const events: Array<Omit<CalendarEvent, 'id'>> = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0] ?? '';
    const field = (name: string) => {
      const match = new RegExp(`^${name}[^:]*:(.*)$`, 'm').exec(body);
      return match?.[1]?.trim();
    };
    const start = field('DTSTART');
    if (!start) continue;
    const digits = start.replace(/[^0-9T]/g, '');
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const timeRaw = digits.includes('T') ? digits.split('T')[1] : '';
    const time = timeRaw ? `${timeRaw.slice(0, 2)}:${timeRaw.slice(2, 4)}` : '09:00';
    const freq = (field('RRULE') ?? '').toUpperCase();
    const repeat = freq.includes('DAILY')
      ? 'daily'
      : freq.includes('WEEKLY')
        ? 'weekly'
        : freq.includes('MONTHLY')
          ? 'monthly'
          : 'none';
    events.push({
      title: field('SUMMARY') ?? 'Imported event',
      date,
      time,
      color: EVENT_COLORS[events.length % EVENT_COLORS.length],
      notes: field('DESCRIPTION'),
      repeat,
    });
  }
  return events;
}
