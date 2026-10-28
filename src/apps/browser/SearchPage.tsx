import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, Globe2, Loader2, Search, Sparkles } from 'lucide-react';
import { useT } from '@/core/localization/i18n';
import { cn } from '@/utils';
import { externalSearchLinks, loadArticle, runWebSearch, type Article, type SearchOutcome } from './search';

interface SearchPageProps {
  query: string;
  lang: string;
  onOpenArticle: (title: string) => void;
  onOpenExternal: (url: string) => void;
  onSearch: (query: string) => void;
}

const SUGGESTED_QUERIES = ['Linux kernel', 'GitHub Pages', 'WebAssembly', 'Persian calligraphy', 'KDE Plasma'];

function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SearchPage({ query, lang, onOpenArticle, onOpenExternal, onSearch }: SearchPageProps) {
  const t = useT();
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!query.trim()) {
      setStatus('ready');
      setOutcome({ query, hits: [], failed: false });
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    runWebSearch(query, { lang, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOutcome(result);
        setStatus(result.failed ? 'error' : 'ready');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus('error');
      });
    return () => controller.abort();
  }, [query, lang]);

  const links = useMemo(() => externalSearchLinks(query || 'Linux'), [query]);
  const hits = outcome?.hits ?? [];

  return (
    <div className="bsearch">
      <div className="bsearch__inner">
        <div className="bsearch__head">
          <span className="bsearch__brand">
            <Sparkles size={13} />
            {t('Nova Search')}
          </span>
          <span className="bsearch__query">{query}</span>
          {status === 'ready' && outcome && !outcome.failed && hits.length > 0 && (
            <span className="bsearch__meta">{t('{count} results from the open web', { count: hits.length })}</span>
          )}
        </div>

        {status === 'loading' && (
          <div className="bsearch__results" aria-busy="true">
            {[0, 1, 2, 3, 4].map((index) => (
              <div className="bsearch__skeleton" key={index} style={{ animationDelay: `${index * 90}ms` }}>
                <span className="bsearch__skeleton-favicon" />
                <span className="bsearch__skeleton-lines">
                  <i style={{ width: `${58 - index * 4}%` }} />
                  <i style={{ width: `${34 + index * 3}%` }} />
                </span>
              </div>
            ))}
            <div className="bsearch__loading">
              <Loader2 size={13} className="bsearch__spin" />
              {t('Searching the open web…')}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bsearch__note bsearch__note--warn">
            <AlertTriangle size={16} />
            <div>
              <strong>{t('The search service could not be reached')}</strong>
              <p>
                {t(
                  'NOVA Search queries public APIs directly from your browser. Check your connection or a content blocker, then try again — or open the query in your real browser:',
                )}
              </p>
              <div className="bsearch__links">
                {links.map((link) => (
                  <button key={link.url} className="bsearch__link-btn" onClick={() => onOpenExternal(link.url)}>
                    {link.label}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <>
            {outcome?.answer && (
              <div className="bsearch__answer">
                <div className="bsearch__answer-head">
                  <Sparkles size={13} />
                  {outcome.answer.heading}
                </div>
                <p>{outcome.answer.text}</p>
                {outcome.answer.url && (
                  <button className="bsearch__link-btn" onClick={() => onOpenExternal(outcome.answer!.url!)}>
                    {hostOfUrl(outcome.answer.url)}
                    <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
            )}

            {outcome?.suggestion && (
              <button className="bsearch__suggestion" onClick={() => onSearch(outcome.suggestion!)}>
                {t('Did you mean')} <strong>{outcome.suggestion}</strong>?
              </button>
            )}

            {hits.length > 0 ? (
              <div className="bsearch__results">
                {hits.map((hit) => (
                  <article className="bsearch__hit" key={hit.id}>
                    <button className="bsearch__hit-main" onClick={() => onOpenArticle(hit.title)}>
                      <span className="bsearch__favicon" aria-hidden>
                        {hit.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="bsearch__hit-text">
                        <span className="bsearch__hit-title">{hit.title}</span>
                        <span className="bsearch__hit-url">{hostOfUrl(hit.url)}</span>
                        {hit.snippet && <span className="bsearch__hit-snippet">{hit.snippet}</span>}
                      </span>
                    </button>
                    {hit.thumbnail && (
                      <img className="bsearch__thumb" src={hit.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    )}
                    <button
                      className="bsearch__hit-open"
                      title={t('Open the real page')}
                      onClick={() => onOpenExternal(hit.url)}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              !outcome?.answer &&
              !outcome?.failed && (
                <div className="bsearch__note">
                  <Globe2 size={16} />
                  <div>
                    <strong>{t('Nothing found for “{query}”', { query })}</strong>
                    <p>{t('Try a different wording, or search the wider web in your real browser:')}</p>
                    <div className="bsearch__links">
                      {links.map((link) => (
                        <button key={link.url} className="bsearch__link-btn" onClick={() => onOpenExternal(link.url)}>
                          {link.label}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}

            {!query.trim() && (
              <div className="bsearch__suggestions">
                <div className="bsearch__suggestions-title">{t('Try searching for')}</div>
                <div className="bsearch__chips">
                  {SUGGESTED_QUERIES.map((idea) => (
                    <button key={idea} className="bsearch__chip" onClick={() => onSearch(idea)}>
                      <Search size={11} />
                      {t(idea)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bsearch__foot">
              <span>
                <BookOpen size={12} />{' '}
                {t('Results are fetched live from the Wikipedia API; answers from DuckDuckGo. Nothing is tracked or stored.')}
              </span>
              <span className="bsearch__foot-links">
                {links.map((link) => (
                  <button key={link.url} className={cn('bsearch__link-btn', 'is-quiet')} onClick={() => onOpenExternal(link.url)}>
                    {link.label}
                    <ArrowUpRight size={11} />
                  </button>
                ))}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ArticlePageProps {
  title: string;
  lang: string;
  onOpenExternal: (url: string) => void;
  onSearch: (query: string) => void;
  onBack: () => void;
}

export function ArticlePage({ title, lang, onOpenExternal, onSearch, onBack }: ArticlePageProps) {
  const t = useT();
  const [article, setArticle] = useState<Article | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    loadArticle(title, { lang, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setArticle(result);
      setStatus(result ? 'ready' : 'error');
    });
    return () => controller.abort();
  }, [title, lang]);

  if (status === 'loading') {
    return (
      <div className="bsearch bsearch--article">
        <div className="bsearch__inner">
          <div className="bsearch__article-skeleton">
            <span className="bsearch__skeleton-favicon" />
            <i style={{ width: '46%' }} />
            <i style={{ width: '88%' }} />
            <i style={{ width: '94%' }} />
            <i style={{ width: '72%' }} />
          </div>
          <div className="bsearch__loading">
            <Loader2 size={13} className="bsearch__spin" />
            {t('Loading article…')}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !article) {
    return (
      <div className="bsearch bsearch--article">
        <div className="bsearch__inner">
          <div className="bsearch__note bsearch__note--warn">
            <AlertTriangle size={16} />
            <div>
              <strong>{t('This article could not be loaded')}</strong>
              <p>{t('The request to the Wikipedia API failed. You can open it in your real browser instead.')}</p>
              <div className="bsearch__links">
                <button className="bsearch__link-btn" onClick={() => onOpenExternal(`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`)}>
                  {t('Open on Wikipedia')}
                  <ArrowUpRight size={12} />
                </button>
                <button className="bsearch__link-btn" onClick={() => onSearch(title)}>
                  <Search size={12} />
                  {t('Search again')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bsearch bsearch--article">
      <div className="bsearch__inner">
        <div className="bsearch__article-head">
          <button className="bsearch__link-btn is-quiet" onClick={onBack}>
            ← {t('Back to results')}
          </button>
          <button className="bsearch__link-btn is-quiet" onClick={() => onOpenExternal(article.url)}>
            {t('Read on Wikipedia')}
            <ArrowUpRight size={11} />
          </button>
        </div>
        <article className="bsearch__article">
          {article.thumbnail && (
            <img className="bsearch__article-image" src={article.thumbnail} alt="" referrerPolicy="no-referrer" />
          )}
          <h1>{article.title}</h1>
          <div className="bsearch__article-meta">
            <Globe2 size={12} /> {lang}.wikipedia.org
          </div>
          {article.blocks.map((block, index) =>
            block.type === 'heading' ? (
              <h2 key={`h-${index}`}>{block.text}</h2>
            ) : (
              <p key={`p-${index}`}>{block.text}</p>
            ),
          )}
        </article>
      </div>
    </div>
  );
}
