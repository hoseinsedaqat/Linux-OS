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
