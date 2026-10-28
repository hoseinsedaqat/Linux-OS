import type { FSNode, FSNodeKind, Language } from '@/types';

/** crypto.randomUUID with a safe fallback for non-secure contexts. */
export function uid(prefix = ''): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  let raw: string;
  if (cryptoObj && 'randomUUID' in cryptoObj) {
    raw = cryptoObj.randomUUID();
  } else {
    raw = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return prefix ? `${prefix}_${raw}` : raw;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function localeFor(language: Language): string {
  return language === 'fa' ? 'fa-IR' : 'en-US';
}

export function formatDate(
  timestamp: number | Date,
  language: Language,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  try {
    return new Intl.DateTimeFormat(localeFor(language), options).format(
      timestamp instanceof Date ? timestamp : new Date(timestamp),
    );
  } catch {
    return new Date(timestamp).toDateString();
  }
}

export function formatTime(
  timestamp: number | Date,
  language: Language,
  opts: { seconds?: boolean; hour12?: boolean } = {},
): string {
  return formatDate(timestamp, language, {
    hour: '2-digit',
    minute: '2-digit',
    ...(opts.seconds ? { second: '2-digit' } : {}),
    hour12: opts.hour12 ?? false,
  });
}

export function relativeTime(timestamp: number, language: Language): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  try {
    const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto' });
    if (Math.abs(diff) < 60_000) return rtf.format(0, 'minute');
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 30) return rtf.format(-days, 'day');
    return formatDate(timestamp, language);
  } catch {
    return formatDate(timestamp, language);
  }
}

const KIND_BY_EXTENSION: Record<string, FSNodeKind> = {
  txt: 'text',
  md: 'text',
  log: 'text',
  csv: 'text',
  json: 'text',
  html: 'text',
  novadoc: 'document',
  novadocx: 'document',
  docx: 'document',
  doc: 'document',
  novasheet: 'spreadsheet',
  xlsx: 'spreadsheet',
  csvsheet: 'spreadsheet',
  novadeck: 'presentation',
  pptx: 'presentation',
  novanote: 'note',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  webp: 'image',
  gif: 'image',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  app: 'binary',
};

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function kindForName(name: string): FSNodeKind {
  return KIND_BY_EXTENSION[extensionOf(name)] ?? 'text';
}

/** Default extension for a new file created within an app. */
export const APP_FILE_EXTENSIONS = {
  document: 'novadoc',
  spreadsheet: 'novasheet',
  presentation: 'novadeck',
  note: 'novanote',
  text: 'txt',
} as const;

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

export function fileSize(node: FSNode): number {
  if (node.kind === 'folder') return 0;
  return new Blob([node.content ?? '']).size;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Trigger a client-side download without touching any server. */
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function nextInvoiceNumber(existing: string[], type: 'sale' | 'purchase'): string {
  const prefix = type === 'sale' ? 'INV' : 'PUR';
  const numbers = existing
    .map((n) => Number.parseInt(n.replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 1000) + 1;
  return `${prefix}-${next}`;
}

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
