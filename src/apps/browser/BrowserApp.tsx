import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Download,
  ExternalLink,
  Globe2,
  History as HistoryIcon,
  Home,
  Lock,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Star,
  StarOff,
  X,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import type { BrowserTab } from '@/types';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { useClock } from '@/hooks';
import { usePersistedValue } from '@/core/persistence/kvStore';
import {
  addBookmark,
  addHistory,
  browserStore,
  clearHistory,
  displayUrl,
  hostOf,
  isProbablyBlocked,
  normalizeUrl,
  removeBookmark,
} from './browserStore';
import { ArticlePage, SearchPage } from './SearchPage';
import {
  fetchSuggestions,
  looksLikeAddress,
  normalizeWikiLang,
  novaArticleUrl,
  novaSearchUrl,
  parseNovaUrl,
} from './search';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { FOLDER_IDS, childrenOf } from '@/core/virtual-filesystem/fsUtils';
import { openNode } from '@/services/fileActions';
import { EmptyState } from '@/components/common/Controls';
import { useWindows } from '@/core/window-manager/windowsStore';
import { cn, formatDate, uid } from '@/utils';
import { formatLocalizedDate } from '@/core/localization/i18n';

const SHORTCUTS = [
  { label: 'Nova Search', query: 'Web desktop', color: '#3ddc97', letter: 'N' },
  { label: 'Linux', query: 'Linux kernel', color: '#f0b849', letter: 'L' },
  { label: 'TypeScript', query: 'TypeScript', color: '#4f8ff0', letter: 'T' },
  { label: 'Space', query: 'Solar System', color: '#a586ff', letter: 'S' },
  { label: 'Tea', query: 'Green tea', color: '#5fa855', letter: 'G' },
  { label: 'Persian', query: 'Persian language', color: '#e2725b', letter: 'P' },
];

function newTab(): BrowserTab {
  return { id: uid('tab'), history: ['nova://newtab'], historyIndex: 0, title: 'New Tab' };
}

export function BrowserApp({ win }: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const [data] = usePersistedValue(browserStore);
  const nodes = useFiles((state) => state.nodes);
  const setTitle = useWindows((state) => state.setTitle);
  const lang = normalizeWikiLang(language);
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [newTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [address, setAddress] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [panel, setPanel] = useState<'none' | 'bookmarks' | 'history' | 'downloads'>('none');
  const [query, setQuery] = useState('');
  const addressRef = useRef<HTMLInputElement | null>(null);
  const newTabSearchRef = useRef<HTMLInputElement | null>(null);
  const clock = useClock(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [addressFocused, setAddressFocused] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const currentUrl = activeTab?.history[activeTab.historyIndex] ?? 'nova://newtab';
  const novaPage = parseNovaUrl(currentUrl);
  const isNewTab = novaPage?.kind === 'newtab';
  const isSearch = novaPage?.kind === 'search';
  const isArticle = novaPage?.kind === 'article';
  const blocked = novaPage === null && isProbablyBlocked(currentUrl);

  /** What the address bar shows for a given page. */
  const addressFor = (url: string): string => {
    const page = parseNovaUrl(url);
    if (!page || page.kind === 'newtab') return '';
    if (page.kind === 'search') return page.query;
    return page.title;
  };

  useEffect(() => {
    setAddress(addressFor(currentUrl));
    if (novaPage?.kind === 'search') {
      setTitle(win.id, `${novaPage.query || t('Search')} — ${t('Nova Search')}`);
    } else if (novaPage?.kind === 'article') {
      setTitle(win.id, `${novaPage.title} — ${t('Browser')}`);
    } else {
      setTitle(win.id, `${t('Browser')} — ${isNewTab ? t('New Tab') : hostOf(currentUrl) || currentUrl}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, activeTabId]);

  useEffect(() => {
    if (win.payload?.query) {
      navigateTo(normalizeUrl(win.payload.query, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.payload?.query]);

  /* Live search suggestions from Wikipedia's opensearch API. */
  useEffect(() => {
    const value = address.trim();
    if (!addressFocused || value.length < 2 || looksLikeAddress(value)) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSuggestions(value, lang, controller.signal).then((items) => {
        if (!controller.signal.aborted) setSuggestions(items);
      });
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, addressFocused, lang]);

  const updateTab = (id: string, updater: (tab: BrowserTab) => BrowserTab) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? updater(tab) : tab)));
  };

  function navigateTo(url: string) {
    if (!url) return;
    const target = url;
    const page = parseNovaUrl(target);
    const tabTitle =
      page?.kind === 'search'
        ? page.query || 'Search'
        : page?.kind === 'article'
          ? page.title
          : target === 'nova://newtab'
            ? 'New Tab'
            : hostOf(target) || target;
    updateTab(activeTabId, (tab) => {
      const history = [...tab.history.slice(0, tab.historyIndex + 1), target];
      return { ...tab, history, historyIndex: history.length - 1, title: tabTitle };
    });
    if (target !== 'nova://newtab') {
      const label =
        page?.kind === 'search'
          ? `${page.query || 'Search'} — Nova Search`
          : page?.kind === 'article'
            ? page.title
            : hostOf(target) || target;
      addHistory(target, label);
    }
    setPanel('none');
  }

  const search = (value: string) => navigateTo(novaSearchUrl(value, lang));
  const openArticle = (title: string) => navigateTo(novaArticleUrl(title, lang));

  const submitAddress = (event: React.FormEvent) => {
    event.preventDefault();
    const target = normalizeUrl(address, lang);
    if (!target) return;
    setSuggestions([]);
    setAddressFocused(false);
    navigateTo(target);
    addressRef.current?.blur();
  };

  const back = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    updateTab(activeTabId, (tab) => ({ ...tab, historyIndex: tab.historyIndex - 1 }));
    setAddress(addressFor(activeTab.history[activeTab.historyIndex - 1]));
  };

  const forward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    updateTab(activeTabId, (tab) => ({ ...tab, historyIndex: tab.historyIndex + 1 }));
    setAddress(addressFor(activeTab.history[activeTab.historyIndex + 1]));
  };

  const bookmarked = data.bookmarks.some((bookmark) => bookmark.url === currentUrl);
  const downloads = childrenOf(nodes, FOLDER_IDS.downloads);

  const toggleBookmark = () => {
    if (isNewTab) return;
    if (bookmarked) removeBookmark(currentUrl);
    else addBookmark(hostOf(currentUrl) || currentUrl, currentUrl);
  };

  const addTab = () => {
    const tab = newTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setPanel('none');
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      setTabs([newTab()]);
      setActiveTabId(tabs[0].id);
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === id);
    const remaining = tabs.filter((tab) => tab.id !== id);
    setTabs(remaining);
    if (id === activeTabId) setActiveTabId(remaining[Math.max(0, index - 1)].id);
  };

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const pinnedBookmarks = data.bookmarks.filter((bookmark) => bookmark.pinned).slice(0, 6);
  const recentHistory = data.history.slice(0, 6);
  const filteredBookmarks = query
    ? data.bookmarks.filter((bm) => `${bm.title} ${bm.url}`.toLowerCase().includes(query.toLowerCase()))
    : data.bookmarks;
  const filteredHistory = query
    ? data.history.filter((entry) => `${entry.title} ${entry.url}`.toLowerCase().includes(query.toLowerCase()))
    : data.history;

  const newTabPage = useMemo(
    () => (
      <div className="browser__newtab">
        <div className="browser__newtab-clock">{formatLocalizedDate(clock, language, { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
        <div className="small muted" style={{ marginTop: -12 }}>
          {formatLocalizedDate(clock, language, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <form
          className="browser__newtab-search"
          onSubmit={(event) => {
            event.preventDefault();
            const target = normalizeUrl(query, lang);
            if (target) {
              navigateTo(target);
              setQuery('');
            }
          }}
        >
          <Search size={16} />
          <input
            ref={newTabSearchRef}
            placeholder={t('Search the web')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <div className="browser__section">
          <div className="browser__section-title">{t('Popular searches')}</div>
          <div className="browser__shortcuts">
            {SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.query}
                className="browser__shortcut"
                onClick={() => navigateTo(novaSearchUrl(shortcut.query, lang))}
                title={t('Search the open web for “{query}”', { query: shortcut.query })}
              >
                <span className="browser__shortcut-icon" style={{ background: shortcut.color }}>
                  {shortcut.letter}
                </span>
                {t(shortcut.label)}
              </button>
            ))}
          </div>
        </div>
        {pinnedBookmarks.length > 0 && (
          <div className="browser__section">
            <div className="browser__section-title">{t('Bookmarks')}</div>
            <div className="browser__shortcuts">
              {pinnedBookmarks.map((bookmark) => (
                <button key={bookmark.id} className="browser__shortcut" onClick={() => navigateTo(bookmark.url)}>
                  <span className="browser__shortcut-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
                    {bookmark.title.slice(0, 1).toUpperCase()}
                  </span>
                  {bookmark.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {recentHistory.length > 0 && (
          <div className="browser__section">
            <div className="browser__section-title">{t('History')}</div>
            <div className="browser__history-list">
              {recentHistory.map((entry) => (
                <button key={entry.id} className="browser__history-row" onClick={() => navigateTo(entry.url)}>
                  <Clock3 size={13} className="faint" />
                  <span className="truncate">{entry.title}</span>
                  <span className="tiny faint truncate">{displayUrl(entry.url)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="browser__newtab-note">
          <Lock size={12} />{' '}
          {t(
            'Search runs for real: queries are answered from the Wikipedia and DuckDuckGo APIs. Whole websites open in an embedded frame, and sites that forbid embedding are explained instead of faked.',
          )}
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clock, query, data, language, t, pinnedBookmarks, recentHistory],
  );

  return (
    <div className="app browser">
      <div className="browser__tabstrip">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn('browser__tab', tab.id === activeTabId && 'is-active')}
            onClick={() => setActiveTabId(tab.id)}
            title={tab.title}
          >
            <Globe2 size={12} />
            <span className="truncate">{tab.title}</span>
            <span
              role="button"
              tabIndex={0}
              className="browser__tab-close"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') closeTab(tab.id);
              }}
            >
              <X size={11} />
            </span>
          </button>
        ))}
        <button className="icon-btn" onClick={addTab} title={t('New tab')}>
          <Plus size={14} />
        </button>
        <span className="grow" />
        <button
          className={cn('icon-btn', panel === 'bookmarks' && 'is-active')}
          onClick={() => setPanel(panel === 'bookmarks' ? 'none' : 'bookmarks')}
          title={t('Bookmarks')}
        >
          <Star size={15} />
        </button>
        <button
          className={cn('icon-btn', panel === 'history' && 'is-active')}
          onClick={() => setPanel(panel === 'history' ? 'none' : 'history')}
          title={t('History')}
        >
          <HistoryIcon size={15} />
        </button>
        <button
          className={cn('icon-btn', panel === 'downloads' && 'is-active')}
          onClick={() => setPanel(panel === 'downloads' ? 'none' : 'downloads')}
          title={t('Downloads')}
        >
          <Download size={15} />
        </button>
      </div>

      <form className="browser__toolbar" onSubmit={submitAddress}>
        <button type="button" className="icon-btn" onClick={back} disabled={!activeTab || activeTab.historyIndex <= 0} title={t('Back')}>
          <ArrowLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={forward}
          disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1}
          title={t('Forward')}
        >
          <ArrowRight size={16} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setReloadKey((key) => key + 1)} title={t('Reload page')}>
          <RotateCw size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => navigateTo('nova://newtab')} title={t('Home page')}>
          <Home size={15} />
        </button>
        <div className="browser__address">
          {isSearch || isNewTab ? <Search size={12} className="faint" /> : <Lock size={12} className="faint" />}
          <input
            ref={addressRef}
            value={address}
            placeholder={t('Search the web or enter an address')}
            aria-label={t('Search the web or enter an address')}
            onChange={(event) => setAddress(event.target.value)}
            onFocus={(event) => {
              setAddressFocused(true);
              event.currentTarget.select();
            }}
            onBlur={() => window.setTimeout(() => setAddressFocused(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSuggestions([]);
                setAddressFocused(false);
                event.currentTarget.blur();
              }
            }}
          />
          {addressFocused && suggestions.length > 0 && (
            <div className="browser__suggest">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="browser__suggest-row"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setSuggestions([]);
                    setAddressFocused(false);
                    openArticle(item);
                    addressRef.current?.blur();
                  }}
                >
                  <Search size={12} />
                  <span className="truncate">{item}</span>
                  <span className="tiny faint">{t('Article')}</span>
                </button>
              ))}
              <button
                type="button"
                className="browser__suggest-row browser__suggest-row--all"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const target = normalizeUrl(address, lang);
                  setSuggestions([]);
                  setAddressFocused(false);
                  if (target) navigateTo(target);
                  addressRef.current?.blur();
                }}
              >
                <Globe2 size={12} />
                <span className="truncate">{t('Search for “{query}”', { query: address })}</span>
              </button>
            </div>
          )}
          {!isNewTab && !isSearch && !isArticle && (
            <button type="button" className="icon-btn" onClick={toggleBookmark} title={bookmarked ? t('Remove bookmark') : t('Add bookmark')}>
              {bookmarked ? <Star size={14} fill="var(--accent)" color="var(--accent)" /> : <StarOff size={14} />}
            </button>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={() => openExternal(currentUrl)} disabled={isNewTab} title={t('Open in your real browser')}>
          <ExternalLink size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setPanel(panel === 'downloads' ? 'none' : 'downloads')} title={t('Download UI')}>
          <MoreHorizontal size={16} />
        </button>
      </form>

      <div className="browser__viewport">
        {panel === 'bookmarks' && (
          <div className="browser__side-panel">
            <div className="popover__header">
              <span className="popover__title">{t('Bookmarks')}</span>
              <button className="icon-btn" onClick={() => setPanel('none')}>
                <X size={14} />
              </button>
            </div>
            <div className="browser__panel-search">
              <Search size={13} />
              <input className="input input--sm" placeholder={t('Search')} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="browser__panel-list">
              {filteredBookmarks.length === 0 ? (
                <EmptyState compact icon={Star} title={t('No bookmarks yet')} />
              ) : (
                filteredBookmarks.map((bookmark) => (
                  <div key={bookmark.id} className="browser__panel-row">
                    <button className="grow" onClick={() => navigateTo(bookmark.url)}>
                      <div className="truncate small">{bookmark.title}</div>
                      <div className="tiny faint truncate">{displayUrl(bookmark.url)}</div>
                    </button>
                    <button className="icon-btn" onClick={() => removeBookmark(bookmark.url)} title={t('Delete')}>
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {panel === 'history' && (
          <div className="browser__side-panel">
            <div className="popover__header">
              <span className="popover__title">{t('History')}</span>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn btn--sm btn--ghost" onClick={clearHistory}>
                  {t('Clear history')}
                </button>
                <button className="icon-btn" onClick={() => setPanel('none')}>
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="browser__panel-search">
              <Search size={13} />
              <input className="input input--sm" placeholder={t('Search')} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="browser__panel-list">
              {filteredHistory.length === 0 ? (
                <EmptyState compact icon={HistoryIcon} title={t('No history yet')} />
              ) : (
                filteredHistory.slice(0, 80).map((entry) => (
                  <div key={entry.id} className="browser__panel-row">
                    <button className="grow" onClick={() => navigateTo(entry.url)}>
                      <div className="truncate small">{entry.title}</div>
                      <div className="tiny faint">
                        {displayUrl(entry.url)} · {formatDate(entry.visitedAt, language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {panel === 'downloads' && (
          <div className="browser__side-panel">
            <div className="popover__header">
              <span className="popover__title">{t('Downloads')}</span>
              <button className="icon-btn" onClick={() => setPanel('none')}>
                <X size={14} />
              </button>
            </div>
            <div className="browser__panel-list">
              {downloads.length === 0 ? (
                <EmptyState compact icon={Download} title={t('No downloads yet')} description={t('Files exported by simulator apps are downloaded by your real browser. The virtual Downloads folder is shown here.')} />
              ) : (
                downloads.map((node) => (
                  <div key={node.id} className="browser__panel-row">
                    <button className="grow" onClick={() => openNode(node)}>
                      <div className="truncate small">{node.name}</div>
                      <div className="tiny faint">
                        {formatDate(node.modifiedAt, language, { month: 'short', day: 'numeric' })} · {t('Open in Files')}
                      </div>
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => useWindows.getState().openApp('files', { folderPath: '/home/demo/Downloads' })}
                      title={t('Open in Files')}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isSearch ? (
          <SearchPage
            query={(novaPage as { query: string }).query}
            lang={(novaPage as { lang: string }).lang}
            onOpenArticle={openArticle}
            onOpenExternal={openExternal}
            onSearch={search}
          />
        ) : isArticle ? (
          <ArticlePage
            title={(novaPage as { title: string }).title}
            lang={(novaPage as { lang: string }).lang}
            onOpenExternal={openExternal}
            onSearch={search}
            onBack={back}
          />
        ) : isNewTab ? (
          newTabPage
        ) : blocked ? (
          <div className="browser__blocked">
            <div className="browser__blocked-icon">
              <Lock size={26} />
            </div>
            <h2>{t('This site cannot be embedded')}</h2>
            <p className="muted small" style={{ maxWidth: 460 }}>
              {t('Many websites block being displayed inside another page for security reasons.')} ({hostOf(currentUrl) || currentUrl})
            </p>
            <code className="browser__blocked-url">{currentUrl}</code>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn--primary" onClick={() => openExternal(currentUrl)}>
                <ExternalLink size={14} /> {t('Open in your real browser')}
              </button>
              <button className="btn" onClick={() => setReloadKey((key) => key + 1)}>
                <RotateCw size={14} /> {t('Try again')}
              </button>
            </div>
            <p className="tiny faint" style={{ maxWidth: 460, marginTop: 8 }}>
              {t('Browser simulator')} — {t('Web Desktop Simulator')}
            </p>
          </div>
        ) : (
          <>
            <iframe
              key={`${currentUrl}-${reloadKey}`}
              className="browser__frame"
              src={currentUrl}
              title="Browser content"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            <div className="browser__frame-note">
              <Lock size={11} /> {t('If this page stays blank, the site blocks embedding.')}{' '}
              <button className="browser__link" onClick={() => openExternal(currentUrl)}>
                {t('Open in your real browser')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
