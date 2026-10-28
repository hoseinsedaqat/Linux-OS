import type { AppId, FSNode, WindowInstance } from '@/types';
import { extensionOf } from '@/utils';

export interface AppWindowProps {
  win: WindowInstance;
}

/** Common contract every NOVA app implements. */
export interface NovaApp {
  id: AppId;
  component: React.ComponentType<AppWindowProps>;
}

/** Files that belong in the code editor rather than the word processor. */
export const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss',
  'html', 'htm', 'py', 'sh', 'yml', 'yaml',
]);

export function fileAppFor(node: FSNode): AppId {
  switch (node.kind) {
    case 'spreadsheet':
      return 'calc';
    case 'presentation':
      return 'impress';
    case 'note':
      return 'notes';
    case 'text':
      return CODE_EXTENSIONS.has(extensionOf(node.name)) ? 'code' : 'writer';
    case 'document':
      return 'writer';
    case 'image':
      return 'files';
    default:
      return 'files';
  }
}
