import type { AppId, FSNode, SettingsState } from '@/types';
import { fsGetAll, kvClear, kvGetAll, kvSet } from '@/core/persistence/db';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useSettings, DEFAULT_SETTINGS } from '@/core/themes/settingsStore';
import { useLauncher } from '@/core/apps/launcherStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { resetToSample } from '@/apps/accounting/accountingStore';
import { browserStore } from '@/apps/browser/browserStore';
import { calendarStore } from '@/apps/calendar/calendarStore';

export const BACKUP_VERSION = 1;

export interface NovaBackup {
  app: 'nova-linux';
  version: number;
  exportedAt: string;
  settings: Partial<SettingsState>;
  launcher: { installed: AppId[]; favorites: AppId[]; recent: AppId[] };
  files: FSNode[];
  apps: Record<string, unknown>;
}

export async function createBackup(): Promise<NovaBackup> {
  const settings = useSettings.getState();
  const launcher = useLauncher.getState();
  const { set: _set, patch: _patch, reset: _reset, ...rest } = settings;
  return {
    app: 'nova-linux',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: rest,
    launcher: {
      installed: launcher.installed,
      favorites: launcher.favorites,
      recent: launcher.recent,
    },
    files: (await fsGetAll<FSNode>()) as FSNode[],
    apps: await kvGetAll(),
  };
}

export function backupToJson(backup: NovaBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(json: string): NovaBackup {
  const parsed = JSON.parse(json) as Partial<NovaBackup>;
  if (!parsed || parsed.app !== 'nova-linux' || !Array.isArray(parsed.files)) {
    throw new Error('Not a NOVA Linux backup file');
  }
  return {
    app: 'nova-linux',
    version: parsed.version ?? 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    settings: parsed.settings ?? {},
    launcher: parsed.launcher ?? { installed: [], favorites: [], recent: [] },
    files: parsed.files.filter((node) => node && typeof node.id === 'string'),
    apps: parsed.apps ?? {},
  };
}

export async function restoreBackup(backup: NovaBackup): Promise<void> {
  await useFiles.getState().importSnapshot(backup.files);
  for (const [key, value] of Object.entries(backup.apps)) {
    await kvSet(key, value);
  }
  useSettings.setState({
    ...DEFAULT_SETTINGS,
    ...backup.settings,
    customWallpaper: backup.settings.customWallpaper ?? null,
  });
  useLauncher.setState({
    installed: backup.launcher.installed ?? [],
    favorites: backup.launcher.favorites ?? [],
    recent: backup.launcher.recent ?? [],
  });
}

/**
 * Clearing storage must also refresh the in-memory copies of every persisted
 * app, otherwise the UI would keep showing data that no longer exists on disk.
 */
function resetAppStores(): void {
  resetToSample();
  browserStore.set({ bookmarks: [], history: [] });
  calendarStore.set([]);
  useNotifications.getState().clearAll();
  // Imported lazily to avoid a cycle between the backup service and the shell stores.
  void import('@/core/window-manager/windowsStore').then(({ useWindows }) => useWindows.getState().closeAll());
}

export async function clearDemoData(): Promise<void> {
  await kvClear();
  await useFiles.getState().resetToSeed();
  useLauncher.getState().resetLauncher();
  resetAppStores();
}

export async function clearEverything(): Promise<void> {
  await kvClear();
  await useFiles.getState().resetToSeed();
  useLauncher.getState().resetLauncher();
  useSettings.getState().reset();
  resetAppStores();
}
