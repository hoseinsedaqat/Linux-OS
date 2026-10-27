import { create } from 'zustand';
import type { FSNode, FSNodeKind } from '@/types';
import { fsDelete, fsGetAll, fsPut, fsPutMany, fsClear, isStorageUnavailable, getSchemaVersion, setSchemaVersion, SCHEMA_VERSION } from '@/core/persistence/db';
import { createSeedTree } from './seed';
import {
  FOLDER_IDS,
  collectDescendants,
  findByPath,
  isDescendant,
  nodeMap,
  uniqueName,
  type NodeMap,
} from './fsUtils';
import { extensionOf, kindForName, uid } from '@/utils';

interface CreateFileOptions {
  kind?: FSNodeKind;
  meta?: Record<string, unknown>;
  content?: string;
}

interface FilesState {
  nodes: NodeMap;
  ready: boolean;
  error: string | null;
  init: () => Promise<void>;
  createFolder: (parentId: string, name: string) => FSNode | null;
  createFile: (parentId: string, name: string, options?: CreateFileOptions) => FSNode | null;
  updateContent: (id: string, content: string, meta?: Record<string, unknown>) => void;
  renameNode: (id: string, name: string) => boolean;
  moveNode: (id: string, parentId: string) => boolean;
  duplicateNode: (id: string) => FSNode | null;
  trashNode: (id: string) => boolean;
  restoreNode: (id: string) => boolean;
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  toggleStar: (id: string) => void;
  ensureFolderPath: (path: string) => FSNode | null;
  writeFileAtPath: (path: string, content: string, kind?: FSNodeKind, meta?: Record<string, unknown>) => FSNode | null;
  resetToSeed: () => Promise<void>;
  clearUserFiles: () => Promise<void>;
  importSnapshot: (nodes: FSNode[]) => Promise<void>;
}

const USER_FOLDER_IDS = new Set<string>([FOLDER_IDS.desktop, FOLDER_IDS.documents, FOLDER_IDS.downloads, FOLDER_IDS.pictures, FOLDER_IDS.music, FOLDER_IDS.videos, FOLDER_IDS.notes]);

function sanitize(nodes: FSNode[]): FSNode[] {
  return nodes.filter(
    (node) =>
      node &&
      typeof node.id === 'string' &&
      typeof node.name === 'string' &&
      typeof node.kind === 'string',
  );
}

export const useFiles = create<FilesState>((set, get) => ({
  nodes: {},
  ready: false,
  error: null,

  init: async () => {
    try {
      const stored = sanitize(await fsGetAll<FSNode>());
      if (stored.length === 0) {
        const seed = createSeedTree();
        await fsPutMany(seed);
        await setSchemaVersion(SCHEMA_VERSION);
        set({ nodes: nodeMap(seed), ready: true, error: null });
        return;
      }
      // Versioned migration hook: make sure core folders always exist.
      const previousVersion = await getSchemaVersion();
      const map = nodeMap(stored);
      const missing = createSeedTree().filter(
        (node) => node.system && !map[node.id] && !Object.values(map).some((item) => item.name === node.name && item.parentId === node.parentId),
      );
      if (missing.length) {
        await fsPutMany(missing);
        missing.forEach((node) => {
          map[node.id] = node;
        });
      }
      if (previousVersion !== SCHEMA_VERSION) await setSchemaVersion(SCHEMA_VERSION);
      set({ nodes: map, ready: true, error: null });
    } catch (error) {
      const seed = createSeedTree();
      set({
        nodes: nodeMap(seed),
        ready: true,
        error: isStorageUnavailable()
          ? 'Browser storage is unavailable. Changes will only last until you close this tab.'
          : 'Saved data could not be read. A fresh demo file system was loaded.',
      });
      // eslint-disable-next-line no-console
      console.warn('[NOVA] File system init fallback', error);
    }
  },

  createFolder: (parentId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { nodes } = get();
    if (!nodes[parentId]) return null;
    const finalName = uniqueName(nodes, parentId, trimmed);
    const now = Date.now();
    const node: FSNode = {
      id: uid('dir'),
      parentId,
      name: finalName,
      kind: 'folder',
      content: '',
      createdAt: now,
      modifiedAt: now,
    };
    set((state) => ({ nodes: { ...state.nodes, [node.id]: node } }));
    void fsPut(node);
    return node;
  },

  createFile: (parentId, name, options = {}) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { nodes } = get();
    if (!nodes[parentId]) return null;
    const ext = extensionOf(trimmed);
    const kind = options.kind ?? (ext ? kindForName(trimmed) : 'text');
    const withExt = ext ? trimmed : `${trimmed}.${kind === 'folder' ? 'txt' : 'txt'}`;
    const finalName = uniqueName(nodes, parentId, withExt);
    const now = Date.now();
    const node: FSNode = {
      id: uid('file'),
      parentId,
      name: finalName,
      kind,
      content: options.content ?? '',
      createdAt: now,
      modifiedAt: now,
      meta: options.meta,
    };
    set((state) => ({ nodes: { ...state.nodes, [node.id]: node } }));
    void fsPut(node);
    return node;
  },

  updateContent: (id, content, meta) => {
    const node = get().nodes[id];
    if (!node) return;
    const updated: FSNode = {
      ...node,
      content,
      modifiedAt: Date.now(),
      meta: meta ? { ...node.meta, ...meta } : node.meta,
    };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
  },

  renameNode: (id, name) => {
    const trimmed = name.trim();
    const node = get().nodes[id];
    if (!trimmed || !node || node.system) return false;
    if (trimmed === node.name) return true;
    const parentId = node.parentId ?? FOLDER_IDS.root;
    const siblings = Object.values(get().nodes).filter(
      (item) => item.parentId === parentId && item.id !== id && !item.trashed,
    );
    if (siblings.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return false;
    const keepExt = node.kind !== 'folder';
    const ext = keepExt ? extensionOf(node.name) : '';
    const hasExt = extensionOf(trimmed) !== '';
    const finalName = keepExt && ext && !hasExt ? `${trimmed}.${ext}` : trimmed;
    const updated: FSNode = { ...node, name: finalName, modifiedAt: Date.now() };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
    return true;
  },

  moveNode: (id, parentId) => {
    const { nodes } = get();
    const node = nodes[id];
    const target = nodes[parentId];
    if (!node || !target || target.kind !== 'folder' || node.system) return false;
    if (node.parentId === parentId) return false;
    if (isDescendant(nodes, parentId, id)) return false;
    const siblings = Object.values(nodes).filter((item) => item.parentId === parentId && !item.trashed);
    if (siblings.some((item) => item.name.toLowerCase() === node.name.toLowerCase())) return false;
    const updated: FSNode = { ...node, parentId, modifiedAt: Date.now() };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
    return true;
  },

  duplicateNode: (id) => {
    const { nodes } = get();
    const node = nodes[id];
    if (!node) return null;
    const parentId = node.parentId ?? FOLDER_IDS.root;
    const dot = node.name.lastIndexOf('.');
    const base = dot > 0 ? node.name.slice(0, dot) : node.name;
    const ext = dot > 0 ? node.name.slice(dot) : '';
    const copy: FSNode = {
      ...node,
      id: uid('copy'),
      name: uniqueName(nodes, parentId, `${base} copy${ext}`),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      system: false,
    };
    set((state) => ({ nodes: { ...state.nodes, [copy.id]: copy } }));
    void fsPut(copy);
    return copy;
  },

  trashNode: (id) => {
    const node = get().nodes[id];
    if (!node || node.system) return false;
    const updated: FSNode = { ...node, trashed: true, trashedFrom: node.parentId, deletedAt: Date.now() };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
    return true;
  },

  restoreNode: (id) => {
    const { nodes } = get();
    const node = nodes[id];
    if (!node) return false;
    const targetParent = node.trashedFrom && nodes[node.trashedFrom] ? node.trashedFrom : FOLDER_IDS.home;
    const siblings = Object.values(nodes).filter(
      (item) => item.parentId === targetParent && item.id !== id && !item.trashed,
    );
    const name = siblings.some((item) => item.name.toLowerCase() === node.name.toLowerCase())
      ? uniqueName(nodes, targetParent, node.name)
      : node.name;
    const updated: FSNode = {
      ...node,
      trashed: false,
      parentId: targetParent,
      trashedFrom: null,
      deletedAt: undefined,
      name,
    };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
    return true;
  },

  deleteForever: (id) => {
    const { nodes } = get();
    const node = nodes[id];
    if (!node || node.system) return;
    const ids = collectDescendants(nodes, id);
    set((state) => {
      const next = { ...state.nodes };
      ids.forEach((item) => delete next[item]);
      return { nodes: next };
    });
    ids.forEach((item) => void fsDelete(item));
  },

  emptyTrash: () => {
    const { nodes } = get();
    const trashed = Object.values(nodes).filter((node) => node.trashed);
    const ids = new Set<string>();
    trashed.forEach((node) => collectDescendants(nodes, node.id).forEach((id) => ids.add(id)));
    set((state) => {
      const next = { ...state.nodes };
      ids.forEach((id) => delete next[id]);
      return { nodes: next };
    });
    ids.forEach((id) => void fsDelete(id));
  },

  toggleStar: (id) => {
    const node = get().nodes[id];
    if (!node) return;
    const updated = { ...node, starred: !node.starred };
    set((state) => ({ nodes: { ...state.nodes, [id]: updated } }));
    void fsPut(updated);
  },

  ensureFolderPath: (path) => {
    const segments = path.split('/').filter(Boolean);
    let currentId: string = FOLDER_IDS.root;
    let currentNode = get().nodes[currentId];
    for (const segment of segments) {
      const { nodes } = get();
      const existing = Object.values(nodes).find(
        (node) => node.parentId === currentId && node.kind === 'folder' && node.name.toLowerCase() === segment.toLowerCase() && !node.trashed,
      );
      if (existing) {
        currentId = existing.id;
        currentNode = existing;
        continue;
      }
      const created = get().createFolder(currentId, segment);
      if (!created) return null;
      currentId = created.id;
      currentNode = created;
    }
    return currentNode ?? null;
  },

  writeFileAtPath: (path, content, kind = 'text', meta) => {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const fileName = segments[segments.length - 1];
    const parentPath = `/${segments.slice(0, -1).join('/')}`;
    const parent = get().ensureFolderPath(parentPath);
    if (!parent) return null;
    const existing = findByPath(get().nodes, path);
    if (existing && existing.kind !== 'folder') {
      get().updateContent(existing.id, content, meta);
      return { ...existing, content, meta: { ...existing.meta, ...meta } };
    }
    return get().createFile(parent.id, fileName, { kind, content, meta });
  },

  resetToSeed: async () => {
    const seed = createSeedTree();
    await fsClear();
    await fsPutMany(seed);
    set({ nodes: nodeMap(seed), ready: true, error: null });
  },

  clearUserFiles: async () => {
    const { nodes } = get();
    const keep: FSNode[] = [];
    const seed = createSeedTree();
    const seedById = nodeMap(seed);
    Object.values(nodes).forEach((node) => {
      if (node.system || USER_FOLDER_IDS.has(node.id) || node.parentId === null) {
        keep.push(node);
      } else if (seedById[node.id]) {
        keep.push(node);
      } else {
        void fsDelete(node.id);
      }
    });
    const map = nodeMap(keep);
    await fsClear();
    await fsPutMany(keep);
    set({ nodes: map });
  },

  importSnapshot: async (nodes) => {
    const clean = sanitize(nodes).map((node) => ({ ...node, system: Boolean(node.system) }));
    await fsClear();
    await fsPutMany(clean);
    set({ nodes: nodeMap(clean), ready: true });
  },
}));

/** Where a "New item" of a given extension should be created. */
export function defaultNewFileKind(kind: FSNodeKind): { name: string; content: string } {
  switch (kind) {
    case 'document':
      return { name: 'Untitled Document.novadoc', content: JSON.stringify({ title: 'Untitled Document', html: '<p></p>' }) };
    case 'spreadsheet':
      return { name: 'Untitled Spreadsheet.novasheet', content: '' };
    case 'presentation':
      return { name: 'Untitled Presentation.novadeck', content: '' };
    case 'note':
      return { name: 'Untitled Note.novanote', content: '' };
    default:
      return { name: 'New Text File.txt', content: '' };
  }
}

export function getFileById(id: string): FSNode | undefined {
  return useFiles.getState().nodes[id];
}
