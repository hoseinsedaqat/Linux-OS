import readme from '../../../README.md?raw';
import architecture from '../../../docs/ARCHITECTURE.md?raw';
import testing from '../../../docs/TESTING.md?raw';
import shortcuts from '../../../docs/SHORTCUTS.md?raw';

export interface DocEntry {
  id: string;
  title: string;
  description: string;
  source: string;
}

/**
 * The handbooks that ship with this build. They are compiled into the bundle
 * from the repository itself, so what you read inside the simulator is the same
 * document that lives in `docs/`.
 */
export const DOCS: DocEntry[] = [
  {
    id: 'readme',
    title: 'README',
    description: 'What NOVA Linux is, what ships with it, and what it honestly cannot do.',
    source: readme,
  },
  {
    id: 'architecture',
    title: 'Architecture',
    description: 'Shell layers, stores, the virtual file system and the Code editor.',
    source: architecture,
  },
  {
    id: 'shortcuts',
    title: 'Shortcuts',
    description: 'Every keyboard shortcut, including the games and the editor.',
    source: shortcuts,
  },
  {
    id: 'testing',
    title: 'Testing',
    description: 'The automated suites and the manual release checklist.',
    source: testing,
  },
];
