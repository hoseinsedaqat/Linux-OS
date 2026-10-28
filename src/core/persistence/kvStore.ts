import { useEffect, useState } from 'react';
import { kvGet, kvSet } from '@/core/persistence/db';
import { create } from 'zustand';

type Listener<T> = (value: T) => void;

/**
 * Tiny persistent JSON store backed by IndexedDB.
 * Apps that need structured data (calendar, browser, accounting) use this
 * instead of hand-rolling IndexedDB code in every component.
 */
export class PersistedValue<T> {
  private value: T;
  private loaded = false;
  private listeners = new Set<Listener<T>>();
  private readonly key: string;
  private readonly fallback: T;

  constructor(key: string, fallback: T) {
    this.key = key;
    this.fallback = fallback;
    this.value = fallback;
  }

  async load(): Promise<T> {
    const stored = await kvGet<T>(this.key);
    this.value = stored ?? this.fallback;
    this.loaded = true;
    this.emit();
    return this.value;
  }

  get(): T {
    return this.value;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  set(next: T | ((current: T) => T)): T {
    this.value = typeof next === 'function' ? (next as (current: T) => T)(this.value) : next;
    void kvSet(this.key, this.value);
    this.emit();
    return this.value;
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.value));
  }
}

/** React binding for a PersistedValue. */
export function usePersistedValue<T>(store: PersistedValue<T>): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(store.get());
  const [, setLoaded] = useState(store.isLoaded());

  useEffect(() => {
    const unsubscribe = store.subscribe((next) => {
      setValue(next);
      setLoaded(true);
    });
    if (!store.isLoaded()) {
      void store.load();
    } else {
      setValue(store.get());
      setLoaded(true);
    }
    return unsubscribe;
  }, [store]);

  return [value, (next) => store.set(next)];
}

/* ------------------------------------------------------------------ */
/* Simple global UI store for transient app status                     */
/* ------------------------------------------------------------------ */

interface UiState {
  storageWarning: boolean;
  setStorageWarning: (value: boolean) => void;
}

export const useUiStatus = create<UiState>((set) => ({
  storageWarning: false,
  setStorageWarning: (value) => set({ storageWarning: value }),
}));
