import {
  Activity,
  Bomb,
  Bug,
  Calculator,
  CalendarDays,
  CloudSun,
  Folder,
  FolderOpen,
  Gamepad2,
  Globe2,
  Grid3x3,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  Music,
  PenLine,
  Presentation,
  Settings2,
  Sparkles,
  StickyNote,
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
  gamepad: Gamepad2,
  bomb: Bomb,
  hash: Hash,
  bug: Bug,
  grid3x3: Grid3x3,
  music: Music,
  image: ImageIcon,
  'cloud-sun': CloudSun,
};

export function iconForApp(appId: AppId): LucideIcon {
  return ICONS[APP_META[appId].icon] ?? Folder;
}

/* ------------------------------------------------------------------ */
/* Colour maths — every tile is a small three-stop gradient so icons   */
/* read as glossy app tiles instead of flat coloured squares.          */
/* ------------------------------------------------------------------ */

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return [120, 140, 160];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const part = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Blend `hex` towards `target` by `amount` (0–1). */
export function mixColor(hex: string, target: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(target);
  const ratio = Math.max(0, Math.min(1, amount));
  return toHex([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio, a[2] + (b[2] - a[2]) * ratio]);
}

export function rgbaColor(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** CSS custom properties that drive `.app-tile`. */
export function tileStyle(color: string): Record<string, string> {
  return {
    '--tile-color': color,
    '--tile-color-light': mixColor(color, '#ffffff', 0.3),
    '--tile-color-deep': mixColor(color, '#04060b', 0.42),
    '--tile-glow': rgbaColor(color, 0.5),
    '--tile-glow-soft': rgbaColor(color, 0.24),
  };
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
  lg: 23,
  xl: 28,
};

export function AppIcon({ appId, size = 'md', plain = false, className }: AppIconProps) {
  const Icon = iconForApp(appId);
  const meta = APP_META[appId];
  const boxClass =
    size === 'sm'
      ? 'app-tile app-tile--sm'
      : size === 'lg'
        ? 'app-tile app-tile--lg'
        : size === 'xl'
          ? 'app-tile app-tile--xl'
          : size === 'xs'
            ? 'app-tile app-tile--xs'
            : 'app-tile';

  if (plain) {
    return <Icon size={PX[size]} className={className} strokeWidth={1.9} style={{ color: meta.color }} />;
  }

  return (
    <span
      className={cn(boxClass, className)}
      data-app={appId}
      style={tileStyle(meta.color)}
      aria-hidden
    >
      <span className="app-tile__glyph">
        <Icon size={PX[size]} strokeWidth={1.85} color="#fff" />
      </span>
    </span>
  );
}
