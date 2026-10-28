import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppId } from '@/types';

/**
 * Local usage counters.
 *
 * This is the opposite of analytics: nothing is sent anywhere, there is no
 * network call and no identifier. The desktop simply remembers how often you
 * opened each application so Settings → About can show your own habits (and it
 * can be cleared at any time).
 */
interface UsageState {
  counts: Partial<Record<AppId, number>>;
  lastUsed: Partial<Record<AppId, number>>;
  totalOpens: number;
  firstSeen: number;
  record: (appId: AppId) => void;
  reset: () => void;
}

export const useUsage = create<UsageState>()(
  persist(
    (set) => ({
      counts: {},
      lastUsed: {},
      totalOpens: 0,
      firstSeen: Date.now(),
      record: (appId) =>
        set((state) => ({
          counts: { ...state.counts, [appId]: (state.counts[appId] ?? 0) + 1 },
          lastUsed: { ...state.lastUsed, [appId]: Date.now() },
          totalOpens: state.totalOpens + 1,
        })),
      reset: () => set({ counts: {}, lastUsed: {}, totalOpens: 0, firstSeen: Date.now() }),
    }),
    {
      name: 'nova-linux.usage.v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        counts: state.counts,
        lastUsed: state.lastUsed,
        totalOpens: state.totalOpens,
        firstSeen: state.firstSeen,
      }),
    },
  ),
);

export interface UsageRow {
  appId: AppId;
  count: number;
  lastUsed?: number;
}

/** Counts sorted high → low, ready for a bar chart. */
export function usageRows(counts: Partial<Record<AppId, number>>, lastUsed: Partial<Record<AppId, number>>): UsageRow[] {
  return Object.entries(counts)
    .map(([appId, count]) => ({ appId: appId as AppId, count: count ?? 0, lastUsed: lastUsed[appId as AppId] }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}
