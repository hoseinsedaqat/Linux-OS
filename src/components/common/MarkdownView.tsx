import { ExternalLink } from 'lucide-react';
import { cn } from '@/utils';
import { parseInline, type MdBlock } from '@/core/markdown/markdown';

/** One line of inline markdown → React nodes (never raw HTML). */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        if (token.type === 'code') {
          return (
            <code key={index} className="md__code-inline">
              {token.text}
            </code>
          );
        }
        if (token.type === 'bold') return <strong key={index}>{token.text}</strong>;
        if (token.type === 'italic') return <em key={index}>{token.text}</em>;
        if (token.type === 'link') {
          const external = /^https?:/i.test(token.href ?? '');
          return (
            <a
              key={index}
              className="md__link"
              href={token.href}
              {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            >
              {token.text}
              {external && <ExternalLink size={10} />}
            </a>
          );
        }
        return <span key={index}>{token.text}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: MdBlock }) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${block.level}` as unknown) as 'h2';
      return (
        <Tag className={cn('md__heading', `is-h${block.level}`)} id={`md-${block.id}`}>
          <InlineMarkdown text={block.text} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="md__paragraph">
          <InlineMarkdown text={block.text} />
        </p>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className="md__list">
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'code':
      return (
        <pre className="md__code" data-language={block.language || undefined}>
          <code>{block.code}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote className="md__quote">
          <InlineMarkdown text={block.text} />
        </blockquote>
      );
    case 'rule':
      return <hr className="md__rule" />;
    case 'table':
      return (
        <div className="md__table-wrap">
          <table className="md__table">
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index}>
                    <InlineMarkdown text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <InlineMarkdown text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

/** Render parsed markdown. Shared by the Documentation app and the Code preview. */
export function MarkdownView({ blocks, className }: { blocks: MdBlock[]; className?: string }) {
  return (
    <div className={cn('md', className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
