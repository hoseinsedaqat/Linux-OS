import { useEffect, useRef, useState } from 'react';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { HOME_PATH, collectDescendants, findByPath, normalizePath } from '@/core/virtual-filesystem/fsUtils';
import { cn, uid } from '@/utils';
import { runLine, type ShellEffect } from './shell';

interface Line {
  id: string;
  kind: 'input' | 'output' | 'error' | 'success' | 'muted';
  text: string;
}

const WELCOME = [
  'NOVA Terminal — simulated shell',
  'Type "help" to see available commands.',
  'This shell is a simulator and cannot access your real computer.',
];

export function TerminalApp(_props: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const [lines, setLines] = useState<Line[]>(
    WELCOME.map((text) => ({ id: uid('l'), kind: 'muted' as const, text: t(text) })),
  );
  const [cwd, setCwd] = useState(HOME_PATH);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const prompt = `demo@nova:${cwd === HOME_PATH ? '~' : cwd.replace(HOME_PATH, '~')}$`;

  /** Apply the pure shell's side effects to the real stores. */
  const applyEffects = (effects: ShellEffect[]) => {
    const fs = useFiles.getState();
    const nodes = useFiles.getState().nodes;
    for (const effect of effects) {
      if (effect.type === 'mkdir') {
        const parent = findByPath(nodes, effect.parentPath);
        if (parent) fs.createFolder(parent.id, effect.name);
      } else if (effect.type === 'touch') {
        const parent = findByPath(nodes, effect.parentPath);
        if (parent) fs.createFile(parent.id, effect.name, { content: effect.content ?? '' });
      } else if (effect.type === 'write') {
        fs.writeFileAtPath(effect.path, effect.content, 'text');
      } else if (effect.type === 'remove') {
        const node = findByPath(nodes, effect.path);
        if (!node || node.system) continue;
        if (node.kind === 'folder' && effect.recursive) {
          collectDescendants(nodes, node.id)
            .slice()
            .reverse()
            .forEach((id) => {
              if (id !== node.id) fs.deleteForever(id);
            });
        }
        fs.deleteForever(node.id);
      } else if (effect.type === 'open') {
        const node = findByPath(nodes, effect.path);
        if (node) void import('@/services/fileActions').then((module) => module.openNode(node));
      }
    }
  };

  const run = (raw: string) => {
    const command = raw.trim();
    setLines((current) => [...current, { id: uid('l'), kind: 'input', text: `${prompt} ${raw}` }]);
    if (!command) return;
    setHistory((current) => [...current, command]);
    setHistoryIndex(-1);

    const outcome = runLine(command, {
      nodes: useFiles.getState().nodes,
      cwd,
      history,
      language,
    });

    if (outcome.clear) {
      setLines([]);
      return;
    }
    if (outcome.cwd) setCwd(outcome.cwd);
    if (outcome.lines.length > 0) {
      setLines((current) => [
        ...current,
        ...outcome.lines.map((line) => ({ id: uid('l'), kind: line.kind, text: line.text })),
      ]);
    }
    applyEffects(outcome.effects);
  };

  return (
    <div
      className="app terminal"
      onClick={() => inputRef.current?.focus()}
      style={{ direction: 'ltr' }}
    >
      <div className="terminal__screen" ref={scrollRef}>
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'terminal__line',
              line.kind === 'input' && 'terminal__line--input',
              line.kind === 'error' && 'terminal__line--error',
              line.kind === 'success' && 'terminal__line--success',
              line.kind === 'muted' && 'terminal__line--muted',
            )}
          >
            {line.text}
          </div>
        ))}
        <div className="terminal__prompt">
          <span className="terminal__user">{prompt}</span>
          <input
            ref={inputRef}
            className="terminal__input"
            value={input}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Terminal command"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                run(input);
                setInput('');
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (history.length === 0) return;
                const nextIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(nextIndex);
                setInput(history[nextIndex]);
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (historyIndex < 0) return;
                const nextIndex = historyIndex + 1;
                if (nextIndex >= history.length) {
                  setHistoryIndex(-1);
                  setInput('');
                } else {
                  setHistoryIndex(nextIndex);
                  setInput(history[nextIndex]);
                }
              } else if (event.key === 'l' && event.ctrlKey) {
                event.preventDefault();
                setLines([]);
              }
            }}
          />
        </div>
      </div>
      <footer className="app__status">
        <span className="mono tiny">{t('Simulated')} · nova-sh</span>
        <span className="faint mono tiny">{normalizePath(cwd)}</span>
      </footer>
    </div>
  );
}
