import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Hash, Search } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { DOCS } from '@/core/docs/content';
import { useT } from '@/core/localization/i18n';
import { MarkdownView } from '@/components/common/MarkdownView';
import { markdownToText, parseMarkdown, type MdBlock } from '@/core/markdown/markdown';
import { cn } from '@/utils';

/** Documentation — the project handbooks, rendered inside the desktop. */
export function DocsApp(_props: AppWindowProps) {
  const t = useT();
  const [activeId, setActiveId] = useState(DOCS[0].id);
  const [query, setQuery] = useState('');

  const parsed = useMemo(
    () => DOCS.map((doc) => ({ doc, blocks: parseMarkdown(doc.source) })),
    [],
  );

  const active = parsed.find((entry) => entry.doc.id === activeId) ?? parsed[0];
  const toc = useMemo(
    () => active.blocks.filter((block): block is Extract<MdBlock, { type: 'heading' }> => block.type === 'heading' && block.level <= 2),
    [active],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [] as Array<{ docId: string; title: string; line: string }>;
    const results: Array<{ docId: string; title: string; line: string }> = [];
    for (const entry of parsed) {
      const text = markdownToText(entry.blocks).split('\n');
      for (const line of text) {
        if (results.length >= 40) break;
        const at = line.toLowerCase().indexOf(needle);
        if (at < 0) continue;
        results.push({
          docId: entry.doc.id,
          title: entry.doc.title,
          line: `${line.slice(Math.max(0, at - 30), at + needle.length + 46).trim()}`,
        });
      }
    }
    return results;
  }, [parsed, query]);

  const choose = (id: string) => {
    setActiveId(id);
    setQuery('');
  };

  let body: ReactNode;
  if (query.trim()) {
    body = matches.length === 0 ? (
      <p className="docs__empty">{t('Nothing matches “{query}” in these handbooks.', { query })}</p>
    ) : (
      <ul className="docs__matches">
        {matches.map((match, index) => (
          <li key={`${match.docId}-${index}`}>
            <button
              onClick={() => {
                setQuery('');
                setActiveId(match.docId);
                window.setTimeout(() => {
                  const target = document.querySelector('.docs__body');
                  if (target) target.scrollTop = 0;
                }, 0);
              }}
            >
              <span className="docs__match-doc">{match.title}</span>
              <span className="docs__match-line">{match.line}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  } else {
    body = <MarkdownView blocks={active.blocks} className="docs__markdown" />;
  }

  return (
    <div className="app docs">
      <aside className="docs__sidebar" aria-label={t('Handbooks')}>
        <div className="docs__sidebar-head">
          <BookOpen size={14} /> {t('Handbooks')}
        </div>
        <nav className="docs__nav">
          {DOCS.map((doc) => (
            <button
              key={doc.id}
              className={cn('docs__nav-item', doc.id === activeId && !query && 'is-active')}
              onClick={() => choose(doc.id)}
            >
              <strong>{t(doc.title)}</strong>
              <span>{t(doc.description)}</span>
            </button>
          ))}
        </nav>
        <div className="docs__toc">
          <div className="docs__toc-title">
            <Hash size={11} /> {t('On this page')}
          </div>
          {toc.slice(0, 14).map((heading) => (
            <a key={heading.id} href={`#docs-${heading.id}`} className="docs__toc-link">
              {t(heading.text)}
            </a>
          ))}
        </div>
      </aside>

      <section className="docs__main">
        <div className="docs__toolbar">
          <div className="docs__title">
            <strong>{t(active.doc.title)}</strong>
            <span className="faint tiny">
              {t('{n} sections', { n: toc.length })} · {t('Bundled with this build')}
            </span>
          </div>
          <label className="docs__search">
            <Search size={12} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search the handbooks…')}
              aria-label={t('Search the handbooks')}
            />
          </label>
        </div>
        <div className="docs__body">{body}</div>
      </section>
    </div>
  );
}
