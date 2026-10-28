import { describe, expect, it } from 'vitest';
import {
  externalSearchLinks,
  looksLikeAddress,
  mapDuckDuckGo,
  mapWikipediaArticle,
  mapWikipediaSearch,
  novaArticleUrl,
  novaSearchUrl,
  parseArticleExtract,
  parseNovaUrl,
  wikipediaUrlFor,
} from '@/apps/browser/search';
import { displayUrl, normalizeUrl } from '@/apps/browser/browserStore';
import {
  mapDictionary,
  mapHackerNews,
  mapStackExchange,
  searchWikipedia,
} from '@/apps/browser/providers';
import { runWebSearch } from '@/apps/browser/search';

describe('nova:// routing', () => {
  it('round-trips a search URL', () => {
    const url = novaSearchUrl('linux kernel', 'fa');
    expect(url).toBe('nova://search?q=linux%20kernel&lang=fa');
    expect(parseNovaUrl(url)).toEqual({ kind: 'search', query: 'linux kernel', lang: 'fa' });
  });

  it('round-trips an article URL and falls back to English for unknown languages', () => {
    const url = novaArticleUrl('Linux kernel', 'xx');
    expect(parseNovaUrl(url)).toEqual({ kind: 'article', title: 'Linux kernel', lang: 'en' });
  });

  it('treats unknown nova:// paths as the new tab page', () => {
    expect(parseNovaUrl('nova://newtab')).toEqual({ kind: 'newtab' });
    expect(parseNovaUrl('nova://whatever')).toEqual({ kind: 'newtab' });
    expect(parseNovaUrl('https://example.com')).toBeNull();
  });

  it('builds canonical Wikipedia URLs with underscores', () => {
    expect(wikipediaUrlFor('Linux kernel', 'en')).toBe('https://en.wikipedia.org/wiki/Linux_kernel');
  });
});

describe('address bar', () => {
  it('distinguishes addresses from search terms', () => {
    expect(looksLikeAddress('https://example.com')).toBe(true);
    expect(looksLikeAddress('example.com/path')).toBe(true);
    expect(looksLikeAddress('localhost:5173')).toBe(true);
    expect(looksLikeAddress('linux kernel')).toBe(false);
    expect(looksLikeAddress('linux')).toBe(false);
  });

  it('sends free text to Nova Search instead of a dead site', () => {
    expect(normalizeUrl('linux kernel', 'en')).toBe('nova://search?q=linux%20kernel&lang=en');
    expect(normalizeUrl('linux', 'fa')).toBe('nova://search?q=linux&lang=fa');
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(normalizeUrl('nova://newtab')).toBe('nova://newtab');
    expect(normalizeUrl('')).toBe('');
  });

  it('shows a readable label for search and article pages', () => {
    expect(displayUrl('nova://search?q=linux%20kernel&lang=en')).toBe('search: linux kernel');
    expect(displayUrl(novaArticleUrl('Linux kernel'))).toBe('wikipedia: Linux kernel');
    expect(displayUrl('https://example.com')).toBe('example.com');
    expect(displayUrl('nova://newtab')).toBe('');
  });

  it('offers real external search fallbacks', () => {
    const links = externalSearchLinks('a b');
    expect(links.map((link) => link.label)).toEqual(['DuckDuckGo', 'Google', 'Bing']);
    expect(links[0].url).toContain('duckduckgo.com/?q=a%20b');
  });
});

describe('search response mapping', () => {
  it('maps Wikipedia hits in result order and strips HTML', () => {
    const outcome = mapWikipediaSearch(
      {
        query: {
          searchinfo: { totalhits: 99, suggestion: 'kernels' },
          pages: {
            2: { pageid: 2, title: 'Kernel', index: 2, extract: 'A <b>kernel</b> is a core.' },
            1: { pageid: 1, title: 'Linux kernel', index: 1, extract: 'The Linux &amp; GNU kernel.', thumbnail: { source: 'https://img/x.png' } },
          },
        },
      },
      'en',
    );
    expect(outcome.hits.map((hit) => hit.title)).toEqual(['Linux kernel', 'Kernel']);
    expect(outcome.hits[0].snippet).toBe('The Linux & GNU kernel.');
    expect(outcome.hits[0].url).toBe('https://en.wikipedia.org/wiki/Linux_kernel');
    expect(outcome.hits[0].thumbnail).toBe('https://img/x.png');
    expect(outcome.suggestion).toBe('kernels');
    expect(outcome.totalHits).toBe(99);
  });

  it('survives an empty or malformed payload', () => {
    expect(mapWikipediaSearch(null).hits).toEqual([]);
    expect(mapWikipediaSearch({ query: {} }).hits).toEqual([]);
    expect(mapDuckDuckGo(null)).toBeUndefined();
    expect(mapDuckDuckGo({ Heading: 'X' })).toBeUndefined();
  });

  it('maps a DuckDuckGo instant answer', () => {
    expect(
      mapDuckDuckGo({
        Heading: 'Linux kernel',
        AbstractText: 'The core of Linux.',
        AbstractURL: 'https://en.wikipedia.org/wiki/Linux_kernel',
      }),
    ).toEqual({
      heading: 'Linux kernel',
      text: 'The core of Linux.',
      url: 'https://en.wikipedia.org/wiki/Linux_kernel',
      source: 'duckduckgo',
    });
  });

  it('parses wiki headings out of a plain-text extract', () => {
    const blocks = parseArticleExtract('Intro line.\n== History ==\nSecond line.\n\n== Usage ==\nThird.');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Intro line.' },
      { type: 'heading', text: 'History' },
      { type: 'paragraph', text: 'Second line.' },
      { type: 'heading', text: 'Usage' },
      { type: 'paragraph', text: 'Third.' },
    ]);
  });

  it('maps an article and reports missing pages', () => {
    const article = mapWikipediaArticle(
      { query: { pages: { 7: { pageid: 7, title: 'Linux kernel', extract: 'Body.\n== History ==\nOld.', thumbnail: { source: 'https://img/a.png' } } } } },
      'en',
    );
    expect(article?.title).toBe('Linux kernel');
    expect(article?.blocks).toHaveLength(3);
    expect(article?.thumbnail).toBe('https://img/a.png');
    expect(mapWikipediaArticle({ query: { pages: { 7: { title: 'Gone', missing: '' } } } })).toBeNull();
    expect(mapWikipediaArticle({})).toBeNull();
  });
});

describe('search providers', () => {
  it('maps Hacker News stories with metadata and falls back to the item page', () => {
    const hits = mapHackerNews({
      hits: [
        { objectID: '1', title: 'Show HN: A thing', url: 'https://example.com/a', points: 120, num_comments: 44, author: 'pg' },
        { objectID: '2', title: '', story_title: '' },
        { objectID: '3', story_title: 'Ask HN: no url' },
      ],
    });
    expect(hits).toHaveLength(2);
    expect(hits[0].snippet).toContain('120 points');
    expect(hits[0].snippet).toContain('by pg');
    expect(hits[1].url).toBe('https://news.ycombinator.com/item?id=3');
    expect(mapHackerNews(null)).toEqual([]);
  });

  it('maps Stack Exchange questions', () => {
    const hits = mapStackExchange({
      items: [
        { question_id: 7, title: 'How &quot;to&quot; do it', link: 'https://stackoverflow.com/q/7', score: 9, answer_count: 2, is_answered: true, tags: ['js', 'dom'] },
        { question_id: 8, title: '', link: '' },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('How "to" do it');
    expect(hits[0].snippet).toContain('#js');
    expect(hits[0].source).toBe('stackexchange');
  });

  it('turns a dictionary payload into an answer card', () => {
    const answer = mapDictionary([
      { word: 'kernel', phonetic: '/ˈkɜːnəl/', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'The core of an operating system.', example: 'the Linux kernel' }] }], sourceUrls: ['https://en.wiktionary.org/wiki/kernel'] },
    ]);
    expect(answer?.heading).toBe('kernel /ˈkɜːnəl/ · noun');
    expect(answer?.text).toContain('core of an operating system');
    expect(mapDictionary([{ word: 'x' }])).toBeUndefined();
    expect(mapDictionary(null)).toBeUndefined();
  });

  it('resolves wikipedia through the REST fallback when the action API fails', async () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('api.php')) return new Response('nope', { status: 500 });
      if (url.includes('api.wikimedia.org')) return new Response('blocked', { status: 403 });
      return new Response(
        JSON.stringify({
          pages: [
            {
              id: 42,
              title: 'Linux kernel',
              excerpt: '<span class="searchmatch">Linux</span> kernel is the core',
              thumbnail: { url: 'https://img/t.png' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    try {
      const result = await searchWikipedia('linux', 'en');
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].snippet).toBe('Linux kernel is the core');
      expect(calls.some((url) => url.includes('rest.php'))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('never fails the whole search when one provider is down', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('hn.algolia.com')) {
        return new Response(JSON.stringify({ hits: [{ objectID: '9', title: 'HN result', url: 'https://x.test' }] }), { status: 200 });
      }
      return new Response('down', { status: 503 });
    }) as typeof fetch;
    try {
      const outcome = await runWebSearch('react hooks', { lang: 'en', fresh: true });
      expect(outcome.failed).toBe(false);
      expect(outcome.hits.some((hit) => hit.source === 'hackernews')).toBe(true);
      expect(outcome.sources.some((source) => source.state === 'error')).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
