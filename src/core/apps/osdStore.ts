import { create } from 'zustand';

export type OsdKind = 'volume' | 'brightness';

interface OsdState {
  kind: OsdKind | null;
  value: number;
  /** Increments on every change so repeated identical values still animate. */
  nonce: number;
  show: (kind: OsdKind, value: number) => void;
  hide: () => void;
}

/**
 * Small heads-up display for simulated hardware keys (volume / brightness).
 * Purely visual: the values live in the settings store, this only mirrors them.
 */
export const useOsd = create<OsdState>((set) => ({
  kind: null,
  value: 0,
  nonce: 0,
  show: (kind, value) => set((state) => ({ kind, value, nonce: state.nonce + 1 })),
  hide: () => set({ kind: null }),
}));
