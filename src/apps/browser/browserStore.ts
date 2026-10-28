import type { Bookmark, HistoryEntry } from '@/types';
import { PersistedValue } from '@/core/persistence/kvStore';
import { uid } from '@/utils';
import { looksLikeAddress, novaSearchUrl } from './search';

export interface BrowserData {
  bookmarks: Bookmark[];
  history: HistoryEntry[];
}

export const browserStore = new PersistedValue<BrowserData>('app.browser.v1', {
  bookmarks: [
    { id: 'bm-wiki', title: 'Wikipedia', url: 'https://www.wikipedia.org', pinned: true, createdAt: Date.now() },
    { id: 'bm-osm', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org', pinned: true, createdAt: Date.now() },
    { id: 'bm-archive', title: 'Internet Archive', url: 'https://archive.org', pinned: true, createdAt: Date.now() },
    { id: 'bm-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org', pinned: true, createdAt: Date.now() },
  ],
  history: [],
});

export function addBookmark(title: string, url: string): Bookmark {
  const existing = browserStore.get().bookmarks.find((bookmark) => bookmark.url === url);
  if (existing) return existing;
  const bookmark: Bookmark = { id: uid('bm'), title, url, createdAt: Date.now() };
  browserStore.set((current) => ({ ...current, bookmarks: [...current.bookmarks, bookmark] }));
  return bookmark;
}

export function removeBookmark(url: string): void {
  browserStore.set((current) => ({
    ...current,
    bookmarks: current.bookmarks.filter((bookmark) => bookmark.url !== url),
  }));
}

export function addHistory(url: string, title: string): void {
  if (!url || url.startsWith('nova://')) return;
  browserStore.set((current) => {
    const entry: HistoryEntry = { id: uid('hist'), url, title, visitedAt: Date.now() };
    const filtered = current.history.filter((item) => item.url !== url);
    return { ...current, history: [entry, ...filtered].slice(0, 200) };
  });
}

export function clearHistory(): void {
  browserStore.set((current) => ({ ...current, history: [] }));
}

export const BLOCKED_HOSTS = [
  'google.com',
  'www.google.com',
  'youtube.com',
  'www.youtube.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'twitter.com',
  'x.com',
  'github.com',
  'www.github.com',
  'linkedin.com',
  'www.linkedin.com',
  'reddit.com',
  'www.reddit.com',
  'amazon.com',
  'www.amazon.com',
  'netflix.com',
  'duckduckgo.com',
  'html.duckduckgo.com',
  'developer.mozilla.org',
  'stackoverflow.com',
];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isProbablyBlocked(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

/**
 * Turn whatever was typed in the address bar into something the shell can open.
 * Real URLs stay URLs; anything else becomes a live Nova Search query — which is
 * answered with real search results (see `search.ts`) instead of a dead page.
 */
export function normalizeUrl(input: string, lang = 'en'): string {
  const value = input.trim();
  if (!value) return '';
  if (value === 'nova://newtab' || value === 'about:newtab') return 'nova://newtab';
  if (value.startsWith('nova://')) return value;
  if (looksLikeAddress(value)) {
    if (/^localhost(:\d+)?(\/|$)/i.test(value)) return `http://${value}`;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
    return `https://${value}`;
  }
  return novaSearchUrl(value, lang);
}

export function displayUrl(url: string): string {
  if (url === 'nova://newtab') return '';
  const search = /^nova:\/\/search\?q=([^&]*)/.exec(url);
  if (search) {
    try {
      return `search: ${decodeURIComponent(search[1])}`;
    } catch {
      return 'search';
    }
  }
  if (url.startsWith('nova://article/')) {
    try {
      return `wikipedia: ${decodeURIComponent(url.slice('nova://article/'.length).split('?')[0])}`;
    } catch {
      return 'wikipedia';
    }
  }
  return url.replace(/^https?:\/\//, '');
}
