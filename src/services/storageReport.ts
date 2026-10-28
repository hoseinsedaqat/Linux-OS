import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { useLauncher } from '@/core/apps/launcherStore';
import { useSettings } from '@/core/themes/settingsStore';
import { useUsage } from '@/core/analytics/usage';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { clearSession } from '@/core/window-manager/session';
import { clearEverything } from '@/services/backup';

/**
 * A profile report for the reset flow.
 *
 * "Clear everything" used to be a single button with one sentence. Before a
 * destructive action the user should see exactly what is about to disappear, so
 * this module counts it first.
 */
export interface ProfileReport {
  files: number;
  folders: number;
  trashed: number;
  notes: number;
  documents: number;
  spreadsheets: number;
  presentations: number;
  images: number;
  desktopIcons: number;
  pinnedApps: number;
  installedApps: number;
  notifications: number;
  settingsChanged: number;
  usageRecords: number;
  totalOpens: number;
  hasWallpaper: boolean;
  hasSession: boolean;
  localKeys: number;
  profileAgeDays: number;
}

const SETTING_KEYS: Array<keyof ReturnType<typeof useSettings.getState>> = [];

export function profileReport(): ProfileReport {
  const nodes = Object.values(useFiles.getState().nodes);
  const visible = nodes.filter((node) => !node.trashed);
  const launcher = useLauncher.getState();
  const settings = useSettings.getState();
  const usage = useUsage.getState();
  const notifications = useNotifications.getState();

  let localKeys = 0;
  let hasSession = false;
  try {
    localKeys = Object.keys(localStorage).filter((key) => key.startsWith('nova-') || key.startsWith('nova.')).length;
    hasSession = Boolean(localStorage.getItem('nova-linux.session.v1'));
  } catch {
    /* storage blocked */
  }

  const changedSettings = Object.entries(settings).filter(([key, value]) => {
    if (SETTING_KEYS.includes(key as never)) return false;
    return typeof value !== 'function';
  }).length;

  const ageDays = usage.firstSeen ? Math.max(0, Math.round((Date.now() - usage.firstSeen) / 86_400_000)) : 0;

  return {
    files: visible.filter((node) => node.kind !== 'folder').length,
    folders: visible.filter((node) => node.kind === 'folder').length,
    trashed: nodes.filter((node) => node.trashed).length,
    notes: visible.filter((node) => node.kind === 'note').length,
    documents: visible.filter((node) => node.kind === 'document').length,
    spreadsheets: visible.filter((node) => node.kind === 'spreadsheet').length,
    presentations: visible.filter((node) => node.kind === 'presentation').length,
    images: visible.filter((node) => node.kind === 'image').length,
    desktopIcons: launcher.desktopApps.length,
    pinnedApps: launcher.favorites.length,
    installedApps: launcher.installed.length,
    notifications: notifications.items.length,
    settingsChanged: changedSettings,
    usageRecords: Object.keys(usage.counts).length,
    totalOpens: usage.totalOpens,
    hasWallpaper: Boolean(settings.customWallpaper),
    hasSession,
    localKeys,
    profileAgeDays: ageDays,
  };
}

/** Wipe the profile: files, app data, preferences, counters and the session. */
export async function resetProfile(): Promise<void> {
  clearSession();
  useUsage.getState().reset();
  useNotifications.getState().clearAll();
  await clearEverything();
}
