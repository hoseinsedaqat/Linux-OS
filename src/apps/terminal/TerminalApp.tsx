import { useEffect, useRef, useState } from 'react';
import type { AppWindowProps } from '@/core/apps/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useT } from '@/core/localization/i18n';
import { HOME_PATH, childrenOf, findByPath, normalizePath, resolvePath, pathOf } from '@/core/virtual-filesystem/fsUtils';
import { cn, uid } from '@/utils';

interface Line {
  id: string;
  kind: 'input' | 'output' | 'error' | 'success' | 'muted';
  text: string;
}

const HELP = `Available commands:
  help              show this help
  clear             clear the screen
  date              show the simulated date
  time              show the simulated time
  whoami            print the current user
  pwd               print the working directory
  ls [path]         list directory contents
  cd [path]         change directory (.. and ~ supported)
  mkdir <name>      create a directory
  touch <name>      create an empty file
  cat <file>        print a file
  echo <text>       print text (use > file to write)
  history           show command history
  neofetch          system information (simulated)
  open <path>       open a file in the desktop
`;

export function TerminalApp(_props: AppWindowProps) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const [lines, setLines] = useState<Line[]>([
    { id: uid('l'), kind: 'muted', text: t('NOVA Terminal — simulated shell') },
    { id: uid('l'), kind: 'muted', text: t('Type "help" to see available commands.') },
    { id: uid('l'), kind: 'muted', text: t('This shell is a simulator and cannot access your real computer.') },
  ]);
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

  const push = (kind: Line['kind'], text: string) => {
    setLines((current) => [...current, { id: uid('l'), kind, text }]);
  };

  const run = (raw: string) => {
    const command = raw.trim();
    setLines((current) => [
      ...current,
      { id: uid('l'), kind: 'input', text: `${prompt} ${raw}` },
    ]);
    if (!command) return;
    setHistory((current) => [...current, command]);
    setHistoryIndex(-1);
    const [name, ...args] = command.split(/\s+/);
    const rest = command.slice(name.length).trim();
    const fs = useFiles.getState();

    switch (name) {
      case 'help':
        push('output', HELP);
        break;
      case 'clear':
        setLines([]);
        break;
      case 'date':
        push('output', new Date().toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'full' }));
        break;
      case 'time':
        push('output', new Date().toLocaleTimeString(language === 'fa' ? 'fa-IR' : 'en-US'));
        break;
      case 'whoami':
        push('output', 'demo');
        break;
      case 'pwd':
        push('output', cwd);
        break;
      case 'ls': {
        const target = args[0] ? resolvePath(useFiles.getState().nodes, cwd, args[0].replace('~', HOME_PATH)) : cwd;
        const node = findByPath(useFiles.getState().nodes, target);
        if (!node || node.kind !== 'folder') {
          push('error', `ls: cannot access '${args[0] ?? target}': No such directory`);
          break;
        }
        const children = childrenOf(useFiles.getState().nodes, node.id);
        if (children.length === 0) push('muted', '(empty)');
        else
          push(
            'output',
            children
              .map((child) => (child.kind === 'folder' ? `${child.name}/` : child.name))
              .join('   '),
          );
        break;
      }
      case 'cd': {
        const target = resolvePath(useFiles.getState().nodes, cwd, (args[0] ?? HOME_PATH).replace('~', HOME_PATH));
        const node = findByPath(useFiles.getState().nodes, target);
        if (!node || node.kind !== 'folder') {
          push('error', `cd: no such directory: ${args[0] ?? ''}`);
          break;
        }
        setCwd(pathOf(useFiles.getState().nodes, node.id));
        break;
      }
      case 'mkdir': {
        if (!args[0]) {
          push('error', 'mkdir: missing directory name');
          break;
        }
        const parent = findByPath(useFiles.getState().nodes, cwd);
        if (!parent) {
          push('error', 'mkdir: current directory is unavailable');
          break;
        }
        const created = fs.createFolder(parent.id, args[0]);
        if (!created) push('error', `mkdir: cannot create '${args[0]}'`);
        break;
      }
      case 'touch': {
        if (!args[0]) {
          push('error', 'touch: missing file name');
          break;
        }
        const parent = findByPath(useFiles.getState().nodes, cwd);
        if (!parent) {
          push('error', 'touch: current directory is unavailable');
          break;
        }
        const created = fs.createFile(parent.id, args[0], { content: '' });
        if (!created) push('error', `touch: cannot create '${args[0]}'`);
        break;
      }
      case 'cat': {
        const target = resolvePath(useFiles.getState().nodes, cwd, (args[0] ?? '').replace('~', HOME_PATH));
        const node = findByPath(useFiles.getState().nodes, target);
        if (!node) {
          push('error', `cat: ${args[0]}: No such file`);
          break;
        }
        if (node.kind === 'folder') {
          push('error', `cat: ${args[0]}: Is a directory`);
          break;
        }
        push('output', node.content || '(empty file)');
        break;
      }
      case 'echo': {
        const writeMatch = /^(.*?)\s*>\s*(\S+)$/.exec(rest);
        if (writeMatch) {
          const text = writeMatch[1].replace(/^["']|["']$/g, '');
          const target = resolvePath(useFiles.getState().nodes, cwd, writeMatch[2]);
          fs.writeFileAtPath(target, text, 'text');
          break;
        }
        push('output', rest.replace(/^["']|["']$/g, '') || '');
        break;
      }
      case 'history':
        push('output', history.map((entry, index) => `${index + 1}  ${entry}`).join('\n') || '(no history)');
        break;
      case 'neofetch': {
        const nodes = useFiles.getState().nodes;
        const files = Object.values(nodes).filter((node) => node.kind !== 'folder' && !node.trashed).length;
        const folders = Object.values(nodes).filter((node) => node.kind === 'folder').length;
        push(
          'output',
          [
            '       /\\        demo@nova',
            '      /  \\       ---------',
            '     / /\\ \\      OS: NOVA Linux 1.0 (web simulator)',
            '    / ____ \\     Kernel: none — JavaScript simulation',
            '   /_/    \\_\\    Shell: nova-sh (sandboxed)',
            '                 Session: web desktop',
            `                 Files: ${files} · Folders: ${folders}`,
            `                 Resolution: ${window.innerWidth}×${window.innerHeight}`,
            `                 Locale: ${language === 'fa' ? 'fa_IR' : 'en_US'}`,
          ].join('\n'),
        );
        break;
      }
      case 'open': {
        const target = resolvePath(useFiles.getState().nodes, cwd, (args[0] ?? '').replace('~', HOME_PATH));
        const node = findByPath(useFiles.getState().nodes, target);
        if (!node) {
          push('error', `open: ${args[0] ?? ''}: No such file`);
          break;
        }
        // Lazy import avoids a circular dependency with the app registry.
        void import('@/services/fileActions').then((module) => module.openNode(node));
        push('success', `Opening ${node.name}…`);
        break;
      }
      default:
        push('error', `nova-sh: ${name}: ${t('command not found')}. ${t('Type "help" to see available commands.')}`);
    }
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
