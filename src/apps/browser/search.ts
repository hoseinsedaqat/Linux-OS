/**
 * NOVA Search — real web search inside the simulated browser.
 *
 * The browser cannot embed most real websites (they send `X-Frame-Options` /
 * `frame-ancestors`), and it must not pretend that it did. So instead of faking
 * a results page, queries are answered with *real* data from public,
 * CORS-enabled APIs and rendered natively by the shell:
 *
 *  - Wikipedia search API (MediaWiki `generator=search`) → article results,
 *    short intro extracts and thumbnails.
 *  - Wikipedia article API → the reader view.
 *  - DuckDuckGo Instant Answer API → an optional "instant answer" card.
 *
 * Every request is a plain `fetch` from the user's browser; no proxy, no key,
 * no tracking, nothing stored server-side. When a request fails the UI says so
 * and offers to open the query in the real browser.
 */

export type SearchSource = 'wikipedia' | 'duckduckgo' | 'hackernews' | 'stackexchange' | 'dictionary';

export interface SearchHit {
  id: string;
  title: string;
  /** Real, clickable URL on the open web. */
  url: string;
  snippet: string;
  thumbnail?: string;
  source: SearchSource;
}

export interface InstantAnswer {
  heading: string;
  text: string;
  url?: string;
  source: SearchSource;
}

export interface SearchSourceStatus {
  id: SearchSource | 'wikipedia';
  label: string;
  state: 'ok' | 'empty' | 'error';
  count: number;
  message?: string;
}

export interface SearchOutcome {
  query: string;
  hits: SearchHit[];
  answer?: InstantAnswer;
  /** "Did you mean …" from the search backend. */
  suggestion?: string;
  totalHits?: number;
  /** Per-provider outcome, so the UI can be honest about what answered. */
  sources: SearchSourceStatus[];
  /** True when *every* provider failed (offline, blocked network, …). */
  failed: boolean;
}

/* ------------------------------------------------------------------ */
/* nova:// URL scheme                                                  */
/* ------------------------------------------------------------------ */

export type NovaPage =
  | { kind: 'newtab' }
  | { kind: 'search'; query: string; lang: string }
  | { kind: 'article'; title: string; lang: string };

export const WIKI_LANGUAGES = ['en', 'fa', 'de', 'fr', 'es', 'ar', 'tr', 'ru'] as const;

export function normalizeWikiLang(lang?: string | null): string {
  const value = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (WIKI_LANGUAGES as readonly string[]).includes(value) ? value : 'en';
}

export function novaSearchUrl(query: string, lang = 'en'): string {
  return `nova://search?q=${encodeURIComponent(query.trim())}&lang=${normalizeWikiLang(lang)}`;
}

export function novaArticleUrl(title: string, lang = 'en'): string {
  return `nova://article/${encodeURIComponent(title.trim())}?lang=${normalizeWikiLang(lang)}`;
}

export function wikipediaUrlFor(title: string, lang = 'en'): string {
  return `https://${normalizeWikiLang(lang)}.wikipedia.org/wiki/${encodeURIComponent(title.trim().replace(/\s+/g, '_'))}`;
}

/** True when the address-bar value is a URL/domain rather than a search term. */
export function looksLikeAddress(value: string): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true;
  if (/^localhost(:\d+)?(\/|$)/i.test(trimmed)) return true;
  return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed);
}

/** Parse any address-bar value into a page the shell knows how to render. */
export function parseNovaUrl(url: string): NovaPage | null {
  const value = (url ?? '').trim();
  if (!value) return null;
  if (value === 'nova://newtab' || value === 'about:newtab') return { kind: 'newtab' };
  if (!value.startsWith('nova://')) return null;

  const rest = value.slice('nova://'.length);
  const [path, rawQuery = ''] = rest.split('?');
  const params = new URLSearchParams(rawQuery);
  const lang = normalizeWikiLang(params.get('lang'));

  if (path === 'search') {
    return { kind: 'search', query: (params.get('q') ?? '').trim(), lang };
  }
  if (path.startsWith('article/')) {
    let title = path.slice('article/'.length);
    try {
      title = decodeURIComponent(title);
    } catch {
      /* keep the raw value */
    }
    return { kind: 'article', title: title.replace(/_/g, ' ').trim(), lang };
  }
  return { kind: 'newtab' };
}

/* ------------------------------------------------------------------ */
/* Pure response mapping (unit-tested without the network)             */
/* ------------------------------------------------------------------ */

interface WikiPage {
  pageid?: number;
  title?: string;
  index?: number;
  extract?: string;
  thumbnail?: { source?: string };
  missing?: string;
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiPage>;
    searchinfo?: { totalhits?: number; suggestion?: string };
  };
  error?: { info?: string };
}

export function toPlainText(value: unknown): string {
  return toText(value);
}

function toText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapWikipediaSearch(
  json: unknown,
  lang = 'en',
): { hits: SearchHit[]; suggestion?: string; totalHits?: number } {
  const data = (json ?? {}) as WikiQueryResponse;
  const pages = Object.values(data.query?.pages ?? {});
  const hits: SearchHit[] = pages
    .filter((page) => page && page.title && !page.missing)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page, position) => {
      const title = String(page.title);
      return {
        id: `wiki-${page.pageid ?? position}`,
        title,
        url: wikipediaUrlFor(title, lang),
        snippet: toText(page.extract),
        thumbnail: page.thumbnail?.source,
        source: 'wikipedia' as const,
      };
    });
  const suggestion = data.query?.searchinfo?.suggestion
    ? toText(data.query.searchinfo.suggestion)
    : undefined;
  return { hits, suggestion, totalHits: data.query?.searchinfo?.totalhits };
}

interface DdgResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Answer?: string;
  Definition?: string;
}

export function mapDuckDuckGo(json: unknown): InstantAnswer | undefined {
  const data = (json ?? {}) as DdgResponse;
  const heading = toText(data.Heading) || toText(data.AbstractSource);
  const text = toText(data.AbstractText) || toText(data.Answer) || toText(data.Definition);
  if (!heading || !text) return undefined;
  const url = typeof data.AbstractURL === 'string' && /^https?:\/\//.test(data.AbstractURL) ? data.AbstractURL : undefined;
  return { heading, text, url, source: 'duckduckgo' };
}

export interface ArticleBlock {
  type: 'heading' | 'paragraph';
  text: string;
}

export interface Article {
  title: string;
  description?: string;
  extract: string;
  blocks: ArticleBlock[];
  thumbnail?: string;
  url: string;
}

/** Split a plain-text Wikipedia extract into headings and paragraphs. */
export function parseArticleExtract(extract: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const rawLine of extract.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^={2,6}\s*(.+?)\s*={2,6}$/.exec(line);
    if (heading) blocks.push({ type: 'heading', text: heading[1] });
    else blocks.push({ type: 'paragraph', text: line });
  }
  return blocks;
}

export function mapWikipediaArticle(json: unknown, lang = 'en'): Article | null {
  const data = (json ?? {}) as WikiQueryResponse;
  const page = Object.values(data.query?.pages ?? {})[0] as (WikiPage & { title?: string }) | undefined;
  if (!page || page.missing || !page.title) return null;
  const extract = typeof page.extract === 'string' ? page.extract : '';
  if (!extract) return null;
  const blocks = parseArticleExtract(extract);
  const firstParagraph = blocks.find((block) => block.type === 'paragraph');
  return {
    title: page.title,
    description: firstParagraph ? firstParagraph.text.slice(0, 180) : undefined,
    extract,
    blocks,
    thumbnail: page.thumbnail?.source,
    url: wikipediaUrlFor(page.title, lang),
  };
}

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

const API_TIMEOUT = 9000;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const { fetchJson: fetchOnce } = await import('./providers');
  return fetchOnce<T>(url, signal, API_TIMEOUT);
}

function wikiApi(lang: string): string {
  return `https://${normalizeWikiLang(lang)}.wikipedia.org/w/api.php`;
}

export function wikipediaSearchUrl(query: string, lang = 'en'): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '8',
    gsrnamespace: '0',
    prop: 'pageimages|extracts|info',
    inprop: 'url',
    piprop: 'thumbnail',
    pithumbsize: '160',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: '8',
    redirects: '1',
    gsrinfo: 'totalhits|suggestion',
  });
  return `${wikiApi(lang)}?${params.toString()}`;
}

export function duckDuckGoUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    no_redirect: '1',
    skip_disambig: '1',
  });
  return `https://api.duckduckgo.com/?${params.toString()}`;
}

export function wikipediaArticleUrlApi(title: string, lang = 'en'): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'extracts|pageimages|info',
    inprop: 'url',
    explaintext: '1',
    exsectionformat: 'wiki',
    redirects: '1',
    titles: title,
    piprop: 'thumbnail',
    pithumbsize: '640',
  });
  return `${wikiApi(lang)}?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Aggregated search                                                   */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 5 * 60 * 1000;
const CACHE_LIMIT = 40;
const cache = new Map<string, { at: number; value: SearchOutcome }>();

function cacheKey(query: string, lang: string): string {
  return `${lang}::${query.trim().toLowerCase()}`;
}

/** Drop cached results (used by the "Try again" button). */
export function clearSearchCache(): void {
  cache.clear();
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    const key = hit.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

/**
 * Run a real search across every enabled provider in parallel.
 *
 * Never throws: transport failures are reported per provider, and only if all
 * of them fail is the outcome marked as failed.
 */
export async function runWebSearch(
  query: string,
  options: { lang?: string; signal?: AbortSignal; fresh?: boolean } = {},
): Promise<SearchOutcome> {
  const lang = normalizeWikiLang(options.lang);
  const trimmed = query.trim();
  if (!trimmed) return { query: trimmed, hits: [], sources: [], failed: false };

  const key = cacheKey(trimmed, lang);
  const cached = cache.get(key);
  if (!options.fresh && cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  const { PROVIDERS, runProvider } = await import('./providers');
  const active = PROVIDERS.filter((provider) => !provider.enabled || provider.enabled(trimmed));
  const settled = await Promise.all(
    active.map((provider) => runProvider(provider, trimmed, lang, options.signal)),
  );

  const hits: SearchHit[] = [];
  let answer: InstantAnswer | undefined;
  let suggestion: string | undefined;
  let totalHits: number | undefined;
  const sources: SearchSourceStatus[] = [];
  let anySuccess = false;

  for (const { status, result } of settled) {
    if (!options.signal?.aborted) {
      sources.push(status);
      if (status.state !== 'error') anySuccess = true;
    }
    hits.push(...result.hits);
    if (!answer && result.answer) answer = result.answer;
    if (!suggestion && result.suggestion) suggestion = result.suggestion;
    if (totalHits === undefined && typeof result.totalHits === 'number') totalHits = result.totalHits;
  }

  const value: SearchOutcome = {
    query: trimmed,
    hits: dedupe(hits),
    answer,
    suggestion,
    totalHits,
    sources,
    failed: !anySuccess,
  };

  if (!options.signal?.aborted && (value.hits.length > 0 || value.answer)) {
    if (cache.size >= CACHE_LIMIT) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(key, { at: Date.now(), value });
  }
  return value;
}

/** Load a Wikipedia article for the reader view. Returns null when unavailable. */
export async function loadArticle(title: string, options: { lang?: string; signal?: AbortSignal } = {}): Promise<Article | null> {
  const lang = normalizeWikiLang(options.lang);
  try {
    const json = await fetchJson<WikiQueryResponse>(wikipediaArticleUrlApi(title, lang), options.signal);
    return mapWikipediaArticle(json, lang);
  } catch {
    return null;
  }
}

/** Live search suggestions for the address bar (Wikipedia opensearch). */
export async function fetchSuggestions(query: string, lang = 'en', signal?: AbortSignal): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({
    action: 'opensearch',
    format: 'json',
    origin: '*',
    limit: '6',
    namespace: '0',
    search: trimmed,
  });
  try {
    const json = await fetchJson<unknown[]>(`${wikiApi(lang)}?${params.toString()}`, signal);
    const titles = Array.isArray(json) ? json[1] : undefined;
    if (!Array.isArray(titles)) return [];
    return titles.filter((title): title is string => typeof title === 'string').slice(0, 6);
  } catch {
    return [];
  }
}

/** External "search the whole web" links offered when Wikipedia is not enough. */
export function externalSearchLinks(query: string): Array<{ label: string; url: string }> {
  const q = encodeURIComponent(query.trim());
  return [
    { label: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${q}` },
    { label: 'Google', url: `https://www.google.com/search?q=${q}` },
    { label: 'Bing', url: `https://www.bing.com/search?q=${q}` },
  ];
}
