import type { AppId, FSNode } from '@/types';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useWindows } from '@/core/window-manager/windowsStore';
import { HOME_PATH, findByPath, pathOf } from '@/core/virtual-filesystem/fsUtils';
import { fileAppFor } from '@/core/apps/types';
import { APP_META } from '@/core/apps/appMeta';

export function openNode(node: FSNode): void {
  const nodes = useFiles.getState().nodes;
  const path = pathOf(nodes, node.id);
  if (node.kind === 'folder') {
    useWindows.getState().openApp('files', { folderPath: path, path });
    return;
  }
  const launcher = typeof node.meta?.appId === 'string' ? (node.meta.appId as AppId) : null;
  if (launcher && APP_META[launcher]) {
    useWindows.getState().openApp(launcher, undefined, { title: APP_META[launcher].name });
    return;
  }
  const appId = fileAppFor(node);
  useWindows.getState().openApp(appId, { path }, { title: node.name });
}

export function openPath(path: string, appId?: AppId): void {
  const node = findByPath(useFiles.getState().nodes, path);
  if (!node) return;
  if (appId) {
    useWindows.getState().openApp(appId, { path }, { title: node.name });
    return;
  }
  openNode(node);
}

export function openNewDocument(kind: 'document' | 'spreadsheet' | 'presentation' | 'note'): void {
  const appByKind: Record<string, AppId> = {
    document: 'writer',
    spreadsheet: 'calc',
    presentation: 'impress',
    note: 'notes',
  };
  useWindows.getState().openApp(appByKind[kind], { untitled: true });
}

/** Create a real file inside the virtual FS and open it with the right app. */
export function createFileInFolder(
  folderPath: string,
  name: string,
  content = '',
  kind?: FSNode['kind'],
  meta?: Record<string, unknown>,
): FSNode | null {
  const node = findByPath(useFiles.getState().nodes, folderPath);
  const folderId = node?.id;
  if (!folderId) return null;
  const created = useFiles.getState().createFile(folderId, name, { content, kind, meta });
  return created;
}

export const DEFAULT_DOCUMENT_PATH = `${HOME_PATH}/Documents`;

export function documentsFolderId(): string | undefined {
  return findByPath(useFiles.getState().nodes, DEFAULT_DOCUMENT_PATH)?.id;
}
