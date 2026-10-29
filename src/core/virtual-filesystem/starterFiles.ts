import type { FSNode, FSNodeKind } from '@/types';
import { uid } from '@/utils';
import { childrenOf, type NodeMap } from './fsUtils';

/**
 * The four sample files that ship inside `~/Projects`.
 *
 * They live in the core file system (not in the editor) so every profile has
 * them from the first boot — visible in Files, in Code, and from the terminal.
 */
export interface StarterProjectFile {
  /** Stable id, so the seed tree and repairs never duplicate a file. */
  id: string;
  name: string;
  kind: FSNodeKind;
  content: string;
}

export const STARTER_PROJECT_FILES: readonly StarterProjectFile[] = [
  {
    id: 'file-projects-hello',
    name: 'hello.ts',
    kind: 'text',
    content: `// Welcome to NOVA Code — a small, real editor.
// Everything you save here lands in the virtual file system (IndexedDB),
// so it is still here after a reload.

interface Greeting {
  name: string;
  language: 'en' | 'fa';
}

const table: Record<Greeting['language'], string> = {
  en: 'Hello',
  fa: 'سلام',
};

export function greet({ name, language }: Greeting): string {
  return \`\${table[language]}, \${name}!\`;
}

/** A tiny demo: a list, a sum and a formatted line. */
const apps = ['files', 'code', 'terminal', 'writer'];
const shipped = apps.filter((app) => !app.startsWith('t'));

console.log(greet({ name: 'NOVA', language: 'fa' }));
console.log(\`\${shipped.length} of \${apps.length} apps in the first batch\`);

export function score(lines: number[]): { total: number; average: number } {
  const total = lines.reduce((sum, value) => sum + value, 0);
  return { total, average: total / Math.max(1, lines.length) };
}

console.log(score([12, 18, 30]));
`,
  },
  {
    id: 'file-projects-theme',
    name: 'theme.css',
    kind: 'text',
    content: `/* NOVA — Kali-inspired design tokens.
   Every colour in the shell comes from a variable like these. */
:root {
  --accent: #2fb4ff;
  --accent-2: #4fe3ff;
  --surface-1: #0a0f18;
  --surface-2: #0e1522;
  --text-1: #e8f3ff;
  --text-2: #a3b6cd;
  --border-2: rgba(79, 227, 255, 0.2);
  --radius-md: 6px;
  --radius-window: 9px;
}

[data-theme='kali'] .panel {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border-2);
  border-radius: 10px;
  background: var(--surface-1);
  box-shadow: 0 1px 0 rgba(79, 227, 255, 0.12) inset;
}

[data-theme='kali'] .panel::after {
  content: '';
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-2), transparent);
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: none;
  }
}
`,
  },
  {
    id: 'file-projects-notes',
    name: 'notes.md',
    kind: 'text',
    content: `# Project notes

A Markdown file with a live preview — click the eye button in the toolbar,
or press \`Ctrl + Shift + V\`.

## Done

- [x] Boot sequence and login
- [x] Window manager with snap layouts
- [x] Kali-inspired skin and the dragon wallpaper
- [x] Code editor on the desktop

## Next

- [ ] Write the release notes
- [ ] Try \`formatDocument\` on this file
- [ ] Ship it

## Commands worth trying

\`\`\`bash
ls ~/Projects
cat notes.md | head -n 5
grep -n "Done" notes.md
\`\`\`

> Tip: \`Ctrl + S\` saves, \`Ctrl + F\` searches inside the file, and every
> save writes to the same virtual file system Files and the terminal see.
`,
  },
  {
    id: 'file-projects-data',
    name: 'data.json',
    kind: 'text',
    content: `{
  "name": "nova-linux",
  "version": "1.0.0",
  "simulated": true,
  "theme": {
    "mode": "kali",
    "accent": "#2fb4ff",
    "wallpaper": "wallpaper-kali"
  },
  "apps": [
    { "id": "files", "title": "Files", "pinned": true },
    { "id": "code", "title": "Code", "pinned": true },
    { "id": "terminal", "title": "Terminal", "pinned": false }
  ],
  "limits": {
    "maxWindows": 12,
    "maxUploadBytes": 8388608
  }
}
`,
  },
];

/** Name → source, for the editor's first-run seeding and its unit tests. */
export const STARTER_FILE_CONTENT: Record<string, string> = Object.fromEntries(
  STARTER_PROJECT_FILES.map((file) => [file.name, file.content]),
);

function makeStarterNode(starter: StarterProjectFile, parentId: string, id?: string): FSNode {
  const now = Date.now();
  return {
    id: id ?? uid('file'),
    parentId,
    name: starter.name,
    kind: starter.kind,
    content: starter.content,
    createdAt: now,
    modifiedAt: now,
  };
}

/**
 * Which starter nodes the Projects folder is still missing.
 * Used when the seed tree is built for a brand-new profile.
 */
export function starterProjectNodes(folderId: string): FSNode[] {
  return STARTER_PROJECT_FILES.map((starter) => makeStarterNode(starter, folderId, starter.id));
}

/**
 * Repair pass for profiles that predate the samples (or that were saved with
 * the four files created blank): add missing files and fill empty ones.
 * A file the user has actually written in is never touched, and a file the
 * user deleted on purpose is not resurrected — only the blank/absent case that
 * made the editor look empty is fixed. Returns the nodes to persist.
 */
export function reconcileStarterFiles(nodes: NodeMap, folderId: string): FSNode[] {
  const existing = childrenOf(nodes, folderId, { includeTrashed: true });
  const changes: FSNode[] = [];

  for (const starter of STARTER_PROJECT_FILES) {
    const match = existing.find((node) => node.name.toLowerCase() === starter.name.toLowerCase());

    if (!match) {
      // Respect a deliberate delete: a trashed starter file stays trashed.
      const trashed = Object.values(nodes).some(
        (node) => node.trashed && node.name.toLowerCase() === starter.name.toLowerCase(),
      );
      if (trashed) continue;
      changes.push(makeStarterNode(starter, folderId));
      continue;
    }

    if (!match.trashed && !(match.content ?? '').trim()) {
      changes.push({ ...match, content: starter.content, modifiedAt: Date.now() });
    }
  }

  return changes;
}
