import type { AppId, FSNode, WindowInstance } from '@/types';

export interface AppWindowProps {
  win: WindowInstance;
}

/** Common contract every NOVA app implements. */
export interface NovaApp {
  id: AppId;
  component: React.ComponentType<AppWindowProps>;
}

export function fileAppFor(node: FSNode): AppId {
  switch (node.kind) {
    case 'spreadsheet':
      return 'calc';
    case 'presentation':
      return 'impress';
    case 'note':
      return 'notes';
    case 'document':
    case 'text':
      return 'writer';
    case 'image':
      return 'files';
    default:
      return 'files';
  }
}
