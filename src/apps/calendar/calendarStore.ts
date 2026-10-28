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
