/**
 * Nova Search providers.
 *
 * Every provider talks to a public, CORS-enabled API straight from the browser:
 * no proxy, no key, no server. Search is organised as a small fan-out: each
 * provider is independent, so one blocked or rate-limited host can never make
 * the whole search fail.
 *
 * Providers
 *  - wikipedia   MediaWiki Action API, with two fallbacks (Wikimedia REST API
 *                on api.wikimedia.org and the project-level /w/rest.php).
 *  - hackernews  Algolia Hacker News search (real links + points/comments).
 *  - stackexchange Stack Overflow / Stack Exchange Q&A search.
 *  - dictionary  dictionaryapi.dev — definitions for single words.
 *  - duckduckgo  Instant Answer API — the short "what is this" card.
 */

import {
  mapDuckDuckGo,
  mapWikipediaSearch,
  normalizeWikiLang,
  toPlainText,
  wikipediaSearchUrl,
  type InstantAnswer,
  type SearchHit,
  type SearchSource,
} from './search';

export type ProviderId = SearchSource | 'wikipedia' | 'hackernews' | 'stackexchange' | 'dictionary';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  state: 'ok' | 'empty' | 'error';
  count: number;
  message?: string;
}

export interface ProviderResult {
  hits: SearchHit[];
  answer?: InstantAnswer;
  suggestion?: string;
  totalHits?: number;
}

export interface Provider {
  id: ProviderId;
  label: string;
  /** Grouped under this heading in the results UI. */
  section: string;
  /** Only worth querying for these shapes of query. */
  enabled?: (query: string) => boolean;
  run: (query: string, lang: string, signal?: AbortSignal) => Promise<ProviderResult>;
}

const TIMEOUT = 8000;

/** fetch + timeout + JSON, throwing on non-2xx. */
export async function fetchJson<T>(url: string, signal?: AbortSignal, timeout = TIMEOUT): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const forward = () => controller.abort();
  signal?.addEventListener('abort', forward);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/* ------------------------------------------------------------------ */
/* Wikipedia (3 endpoints, tried in order)                             */
/* ------------------------------------------------------------------ */

interface WikimediaSearchResponse {
  pages?: Array<{
    id?: number;
    key?: string;
    title?: string;
    description?: string | null;
    excerpt?: string | null;
    thumbnail?: { url?: string } | null;
  }>;
}

const WIKI_HOSTS = ['api.wikimedia.org', 'wikipedia.org'] as const;

function wikiRestUrl(host: (typeof WIKI_HOSTS)[number], lang: string, query: string): string {
  const params = new URLSearchParams({ q: query, limit: '8' });
  if (host === 'api.wikimedia.org') {
    return `https://api.wikimedia.org/core/v1/wikipedia/${lang}/search/page?${params.toString()}`;
  }
  return `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?${params.toString()}`;
}

function mapWikimediaSearch(json: WikimediaSearchResponse, lang: string): SearchHit[] {
  return (json.pages ?? [])
    .filter((page) => page && (page.title || page.key))
    .slice(0, 8)
    .map((page, index) => {
      const title = String(page.title ?? page.key ?? '').replace(/_/g, ' ');
      return {
        id: `wiki-rest-${page.id ?? index}`,
        title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`,
        snippet: toPlainText(page.excerpt || page.description || ''),
        thumbnail: page.thumbnail?.url,
        source: 'wikipedia' as const,
      };
    });
}

/** Wikipedia via the Action API first, then two REST endpoints. */
export async function searchWikipedia(query: string, lang: string, signal?: AbortSignal): Promise<ProviderResult> {
  const errors: string[] = [];
  try {
    const json = await fetchJson<unknown>(wikipediaSearchUrl(query, lang), signal);
    const mapped = mapWikipediaSearch(json, lang);
    if (mapped.hits.length > 0) return mapped;
    errors.push('action api: no hits');
  } catch (error) {
    errors.push(`action api: ${(error as Error).message}`);
  }

  for (const host of WIKI_HOSTS) {
    try {
      const json = await fetchJson<WikimediaSearchResponse>(wikiRestUrl(host, lang, query), signal);
      const hits = mapWikimediaSearch(json, lang);
      if (hits.length > 0) return { hits };
    } catch (error) {
      errors.push(`${host}: ${(error as Error).message}`);
    }
  }
  throw new Error(errors.join(' · ') || 'wikipedia unavailable');
}

/* ------------------------------------------------------------------ */
/* Hacker News (Algolia)                                               */
/* ------------------------------------------------------------------ */

interface AlgoliaHit {
  objectID?: string;
  title?: string | null;
  story_title?: string | null;
  url?: string | null;
  story_url?: string | null;
  author?: string;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string;
}

export function mapHackerNews(json: unknown): SearchHit[] {
  const hits = (json as { hits?: AlgoliaHit[] } | null)?.hits ?? [];
  const out: SearchHit[] = [];
  hits.forEach((hit, index) => {
    const title = toPlainText(hit.title || hit.story_title || '');
    const url = hit.url || hit.story_url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '');
    if (!title || !url) return;
    const metaBits: string[] = [];
    if (typeof hit.points === 'number') metaBits.push(`${hit.points} points`);
    if (typeof hit.num_comments === 'number') metaBits.push(`${hit.num_comments} comments`);
    if (hit.author) metaBits.push(`by ${hit.author}`);
    out.push({
      id: `hn-${hit.objectID ?? index}`,
      title,
      url,
      snippet: metaBits.join(' · '),
      source: 'hackernews',
    });
  });
  return out.slice(0, 6);
}

export async function searchHackerNews(query: string, _lang: string, signal?: AbortSignal): Promise<ProviderResult> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: '6',
    advancedSyntax: 'true',
  });
  const json = await fetchJson<unknown>(`https://hn.algolia.com/api/v1/search?${params.toString()}`, signal);
  return { hits: mapHackerNews(json) };
}

/* ------------------------------------------------------------------ */
/* Stack Exchange                                                      */
/* ------------------------------------------------------------------ */

interface StackItem {
  question_id?: number;
  title?: string;
  link?: string;
  score?: number;
  answer_count?: number;
  is_answered?: boolean;
  tags?: string[];
  owner?: { display_name?: string };
}

export function mapStackExchange(json: unknown): SearchHit[] {
  const items = (json as { items?: StackItem[] } | null)?.items ?? [];
  const out: SearchHit[] = [];
  items.forEach((item, index) => {
    const title = toPlainText(item.title || '');
    if (!title || !item.link) return;
    const bits: string[] = [];
    if (typeof item.score === 'number') bits.push(`▲ ${item.score}`);
    if (typeof item.answer_count === 'number') bits.push(`${item.answer_count} answers`);
    if (item.is_answered) bits.push('accepted answer');
    if (item.tags?.length) bits.push(item.tags.slice(0, 3).map((tag) => `#${tag}`).join(' '));
    out.push({
      id: `so-${item.question_id ?? index}`,
      title,
      url: item.link,
      snippet: bits.join(' · '),
      source: 'stackexchange',
    });
  });
  return out.slice(0, 5);
}

export async function searchStackExchange(query: string, _lang: string, signal?: AbortSignal): Promise<ProviderResult> {
  const params = new URLSearchParams({
    order: 'desc',
    sort: 'relevance',
    q: query,
    site: 'stackoverflow',
    pagesize: '5',
    filter: 'default',
  });
  const json = await fetchJson<unknown>(`https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`, signal);
  return { hits: mapStackExchange(json) };
}

/* ------------------------------------------------------------------ */
/* Dictionary                                                          */
/* ------------------------------------------------------------------ */

interface DictionaryEntry {
  word?: string;
  phonetic?: string;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
  sourceUrls?: string[];
}

export function mapDictionary(json: unknown): InstantAnswer | undefined {
  const entries = Array.isArray(json) ? (json as DictionaryEntry[]) : [];
  const entry = entries.find((item) => item?.meanings?.length);
  if (!entry) return undefined;
  const meaning = entry.meanings?.find((item) => item.definitions?.length);
  const definition = meaning?.definitions?.[0];
  if (!definition?.definition) return undefined;
  const word = entry.word ? toPlainText(entry.word) : '';
  const phonetic = entry.phonetic ? ` ${toPlainText(entry.phonetic)}` : '';
  return {
    heading: `${word}${phonetic}${meaning?.partOfSpeech ? ` · ${meaning.partOfSpeech}` : ''}`.trim(),
    text: toPlainText(definition.definition) + (definition.example ? ` — “${toPlainText(definition.example)}”` : ''),
    url: entry.sourceUrls?.[0],
    source: 'dictionary',
  };
}

export async function lookupDefinition(query: string, _lang: string, signal?: AbortSignal): Promise<ProviderResult> {
  const word = query.trim().toLowerCase();
  const json = await fetchJson<unknown>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, signal);
  const answer = mapDictionary(json);
  if (!answer) throw new Error('no definition');
  return { hits: [], answer };
}

/* ------------------------------------------------------------------ */
/* DuckDuckGo instant answer                                           */
/* ------------------------------------------------------------------ */

export async function instantAnswer(query: string, _lang: string, signal?: AbortSignal): Promise<ProviderResult> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    no_redirect: '1',
    skip_disambig: '1',
  });
  const json = await fetchJson<unknown>(`https://api.duckduckgo.com/?${params.toString()}`, signal);
  const answer = mapDuckDuckGo(json);
  if (!answer) throw new Error('no instant answer');
  return { hits: [], answer };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const isSingleWord = (query: string) => /^[\p{L}\p{M}'-]{3,24}$/u.test(query.trim());
const looksTechnical = (query: string) =>
  /\b(js|ts|react|css|html|python|rust|go|java|sql|api|error|npm|node|docker|git|linux|bash|regex|typescript|javascript)\b/i.test(
    query,
  );

export const PROVIDERS: Provider[] = [
  { id: 'wikipedia', label: 'Wikipedia', section: 'Encyclopedia', run: searchWikipedia },
  {
    id: 'hackernews',
    label: 'Hacker News',
    section: 'Community',
    enabled: looksTechnical,
    run: searchHackerNews,
  },
  {
    id: 'stackexchange',
    label: 'Stack Overflow',
    section: 'Q&A',
    enabled: looksTechnical,
    run: searchStackExchange,
  },
  {
    id: 'dictionary',
    label: 'Dictionary',
    section: 'Answers',
    enabled: isSingleWord,
    run: lookupDefinition,
  },
  { id: 'duckduckgo', label: 'DuckDuckGo', section: 'Answers', run: instantAnswer },
];

export async function runProvider(
  provider: Provider,
  query: string,
  lang: string,
  signal?: AbortSignal,
): Promise<{ status: ProviderStatus; result: ProviderResult }> {
  try {
    const result = await provider.run(query, normalizeWikiLang(lang), signal);
    const count = result.hits.length + (result.answer ? 1 : 0);
    return {
      status: {
        id: provider.id,
        label: provider.label,
        state: count > 0 ? 'ok' : 'empty',
        count,
      },
      result,
    };
  } catch (error) {
    return {
      status: {
        id: provider.id,
        label: provider.label,
        state: 'error',
        count: 0,
        message: (error as Error).message,
      },
      result: { hits: [], answer: undefined },
    };
  }
}
