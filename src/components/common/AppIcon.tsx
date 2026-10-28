import {
  Activity,
  Calculator,
  CalendarDays,
  Folder,
  FolderOpen,
  Globe2,
  LayoutGrid,
  PenLine,
  Presentation,
  StickyNote,
  Settings2,
  Sparkles,
  Store,
  Table2,
  TerminalSquare,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { AppId } from '@/types';
import { APP_META } from '@/core/apps/appMeta';
import { cn } from '@/utils';

const ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  'folder-open': FolderOpen,
  globe: Globe2,
  writer: PenLine,
  calc: Table2,
  impress: Presentation,
  notes: StickyNote,
  wallet: Wallet,
  settings: Settings2,
  terminal: TerminalSquare,
  calculator: Calculator,
  calendar: CalendarDays,
  store: Store,
  activity: Activity,
  trash: Trash2,
  sparkles: Sparkles,
  apps: LayoutGrid,
};

export function iconForApp(appId: AppId): LucideIcon {
  return ICONS[APP_META[appId].icon] ?? Folder;
}

interface AppIconProps {
  appId: AppId;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  plain?: boolean;
  className?: string;
}

const PX: Record<NonNullable<AppIconProps['size']>, number> = {
  xs: 12,
  sm: 15,
  md: 19,
  lg: 24,
  xl: 30,
};

export function AppIcon({ appId, size = 'md', plain = false, className }: AppIconProps) {
  const Icon = iconForApp(appId);
  const meta = APP_META[appId];
  const boxClass = size === 'sm' ? 'app-tile app-tile--sm' : size === 'lg' ? 'app-tile app-tile--lg' : size === 'xl' ? 'app-tile app-tile--xl' : 'app-tile';
  if (plain) {
    return <Icon size={PX[size]} className={className} strokeWidth={1.9} style={{ color: meta.color }} />;
  }
  return (
    <span
      className={cn(boxClass, className)}
      style={{ ['--tile-color' as string]: meta.color, width: size === 'xs' ? 20 : undefined, height: size === 'xs' ? 20 : undefined }}
    >
      <Icon size={PX[size]} strokeWidth={1.9} color="#fff" />
    </span>
  );
}
