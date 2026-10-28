import type { FSNode } from '@/types';

export type NodeMap = Record<string, FSNode>;

export const ROOT_ID = 'root';
export const HOME_ID = 'home';
export const HOME_PATH = '/home/demo';

export function nodeMap(nodes: FSNode[]): NodeMap {
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

export function childrenOf(
  nodes: NodeMap,
  parentId: string,
  options: { includeTrashed?: boolean } = {},
): FSNode[] {
  return Object.values(nodes)
    .filter((node) => node.parentId === parentId && (options.includeTrashed || !node.trashed))
    .sort((a, b) => {
      if (a.kind === 'folder' && b.kind !== 'folder') return -1;
      if (b.kind === 'folder' && a.kind !== 'folder') return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

export function trashedNodes(nodes: NodeMap): FSNode[] {
  return Object.values(nodes)
    .filter((node) => node.trashed && (!node.parentId || !nodes[node.parentId]?.trashed))
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export function pathOf(nodes: NodeMap, id: string): string {
  const parts: string[] = [];
  let current: FSNode | undefined = nodes[id];
  let guard = 0;
  while (current && guard < 64) {
    if (current.id === ROOT_ID) break;
    parts.unshift(current.name);
    current = current.parentId ? nodes[current.parentId] : undefined;
    guard += 1;
  }
  return `/${parts.join('/')}`;
}

export function findByPath(nodes: NodeMap, path: string): FSNode | undefined {
  const clean = path.split('/').filter(Boolean);
  if (clean.length === 0) return nodes[ROOT_ID];
  let current = nodes[ROOT_ID];
  for (const part of clean) {
    const next = Object.values(nodes).find(
      (node) => node.parentId === current.id && node.name.toLowerCase() === part.toLowerCase() && !node.trashed,
    );
    if (!next) return undefined;
    current = next;
  }
  return current;
}

export function resolvePath(_nodes: NodeMap, basePath: string, target: string): string {
  if (target.startsWith('/')) return normalizePath(target);
  const segments = basePath.split('/').filter(Boolean);
  const targetSegments = target.split('/').filter(Boolean);
  for (const segment of targetSegments) {
    if (segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return normalizePath(`/${segments.join('/')}`);
}

export function normalizePath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return `/${stack.join('/')}`;
}

/** True when `candidateId` is a descendant of `ancestorId`. */
export function isDescendant(nodes: NodeMap, candidateId: string, ancestorId: string): boolean {
  let current: FSNode | undefined = nodes[candidateId];
  let guard = 0;
  while (current && guard < 64) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? nodes[current.parentId] : undefined;
    guard += 1;
  }
  return false;
}

export function uniqueName(nodes: NodeMap, parentId: string, desired: string): string {
  const siblings = Object.values(nodes).filter(
    (node) => node.parentId === parentId && !node.trashed,
  );
  const lower = new Set(siblings.map((node) => node.name.toLowerCase()));
  if (!lower.has(desired.toLowerCase())) return desired;
  const dot = desired.lastIndexOf('.');
  const base = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : '';
  let counter = 2;
  let candidate = `${base} (${counter})${ext}`;
  while (lower.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }
  return candidate;
}

export function collectDescendants(nodes: NodeMap, id: string): string[] {
  const result: string[] = [id];
  let index = 0;
  while (index < result.length) {
    const current = result[index];
    Object.values(nodes).forEach((node) => {
      if (node.parentId === current) result.push(node.id);
    });
    index += 1;
  }
  return result;
}

export function breadcrumbs(nodes: NodeMap, id: string): Array<{ id: string; name: string }> {
  const crumbs: Array<{ id: string; name: string }> = [];
  let current: FSNode | undefined = nodes[id];
  let guard = 0;
  while (current && guard < 64) {
    crumbs.unshift({ id: current.id, name: current.id === ROOT_ID ? 'File System' : current.name });
    current = current.parentId ? nodes[current.parentId] : undefined;
    guard += 1;
  }
  return crumbs;
}

export const FOLDER_IDS = {
  root: ROOT_ID,
  home: HOME_ID,
  desktop: 'dir-desktop',
  documents: 'dir-documents',
  downloads: 'dir-downloads',
  pictures: 'dir-pictures',
  games: 'dir-games',
  music: 'dir-music',
  videos: 'dir-videos',
  notes: 'dir-notes',
  projects: 'dir-projects',
  usr: 'dir-usr',
  usrShare: 'dir-usr-share',
  usrShareNova: 'dir-usr-share-nova',
  etc: 'dir-etc',
  var: 'dir-var',
  varLog: 'dir-var-log',
} as const;

export const SIDEBAR_PATHS = {
  home: HOME_PATH,
  desktop: `${HOME_PATH}/Desktop`,
  documents: `${HOME_PATH}/Documents`,
  downloads: `${HOME_PATH}/Downloads`,
  pictures: `${HOME_PATH}/Pictures`,
  games: `${HOME_PATH}/Games`,
  music: `${HOME_PATH}/Music`,
  videos: `${HOME_PATH}/Videos`,
  notes: `${HOME_PATH}/Notes`,
} as const;
