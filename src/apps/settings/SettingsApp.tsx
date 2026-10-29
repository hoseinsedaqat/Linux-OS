import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  Bell,
  Clock3,
  Download,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Info,
  Keyboard,
  Languages,
  LayoutPanelTop,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  Terminal,
  SlidersHorizontal,
  Sun,
  Type,
  Upload,
  Volume2,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import type { Language, PanelPosition, SettingsState } from '@/types';
import { accentHex, useSettings } from '@/core/themes/settingsStore';
import { WALLPAPERS, WALLPAPER_THUMBS, wallpaperClass } from '@/core/themes/applyTheme';
import { useT } from '@/core/localization/i18n';
import { useWindows } from '@/core/window-manager/windowsStore';
import { useFiles } from '@/core/virtual-filesystem/fsStore';
import { estimateUsage } from '@/core/persistence/db';
import { useUiStatus } from '@/core/persistence/kvStore';
import { useNotifications } from '@/core/notifications/notificationsStore';
import { notify, notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import { createBackup, backupToJson, parseBackup, restoreBackup, clearDemoData } from '@/services/backup';
import { SectionHeader, Segmented, SliderRow, Toggle } from '@/components/common/Controls';
import { ConfirmDialog } from '@/components/common/Modal';
import { downloadText, formatBytes, cn, fileSize } from '@/utils';
import { NovaLogo } from '@/components/common/NovaLogo';
import { previewSound } from '@/core/audio/sfx';
import { useShell } from '@/core/apps/shellStore';
import { useUsage, usageRows } from '@/core/analytics/usage';
import { compressImage } from '@/utils/image';
import { profileReport, resetProfile } from '@/services/storageReport';
import { Modal } from '@/components/common/Modal';
import { APP_META } from '@/core/apps/appMeta';

type SectionId =
  | 'appearance'
  | 'desktop'
  | 'display'
  | 'brightness'
  | 'wallpapers'
  | 'fonts'
  | 'keyboard'
  | 'language'
  | 'datetime'
  | 'notifications'
  | 'storage'
  | 'privacy'
  | 'accessibility'
  | 'about';

const SECTIONS: Array<{ group: string; items: Array<{ id: SectionId; label: string; icon: typeof Moon }> }> = [
  {
    group: 'Personalization',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'desktop', label: 'Desktop & Panel', icon: LayoutPanelTop },
      { id: 'display', label: 'Display', icon: Monitor },
      { id: 'brightness', label: 'Brightness', icon: Sun },
      { id: 'wallpapers', label: 'Wallpapers', icon: ImageIcon },
      { id: 'fonts', label: 'Fonts', icon: Type },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
      { id: 'language', label: 'Language', icon: Languages },
      { id: 'datetime', label: 'Date & Time', icon: Clock3 },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'storage', label: 'Storage', icon: HardDrive },
      { id: 'privacy', label: 'Privacy', icon: Shield },
      { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
      { id: 'about', label: 'About', icon: Info },
    ],
  },
];

const ACCENTS: Array<{ id: SettingsState['accent']; color: string; label: string }> = [
  { id: 'blue', color: '#2fb4ff', label: 'Kali blue' },
  { id: 'mint', color: '#3ddc97', label: 'Mint' },
  { id: 'sky', color: '#4aa8ff', label: 'Sky' },
  { id: 'violet', color: '#a586ff', label: 'Violet' },
  { id: 'amber', color: '#f2b64c', label: 'Amber' },
  { id: 'rose', color: '#ff7a90', label: 'Rose' },
];

const KEYBOARD_LAYOUTS = [
  { value: 'us', label: 'English (US)' },
  { value: 'uk', label: 'English (UK)' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ir', label: 'فارسی (Iran)' },
];

export function SettingsApp({ win }: AppWindowProps) {
  const t = useT();
  const settings = useSettings();
  const set = useSettings((state) => state.set);
  const reset = useSettings((state) => state.reset);
  const nodes = useFiles((state) => state.nodes);
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const wallpaperRef = useRef<HTMLInputElement | null>(null);
  const [section, setSection] = useState<SectionId>((win.payload?.section as SectionId) ?? 'appearance');
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [confirm, setConfirm] = useState<null | 'clear-demo'>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [report, setReport] = useState<ReturnType<typeof profileReport> | null>(null);
  const usageCounts = useUsage((state) => state.counts);
  const usageLast = useUsage((state) => state.lastUsed);
  const usageTotal = useUsage((state) => state.totalOpens);
  const resetUsage = useUsage((state) => state.reset);
  const [busy, setBusy] = useState(false);
  const storageWarning = useUiStatus((state) => state.storageWarning);
  const notificationsEnabled = useSettings((state) => state.notificationsEnabled);

  useEffect(() => {
    if (win.payload?.section) setSection(win.payload.section as SectionId);
  }, [win.payload?.section]);

  useEffect(() => {
    void estimateUsage().then(setUsage);
  }, [nodes]);

  const fileStats = useMemo(() => {
    const list = Object.values(nodes);
    return {
      files: list.filter((node) => node.kind !== 'folder' && !node.trashed).length,
      folders: list.filter((node) => node.kind === 'folder').length,
      bytes: list.reduce((acc, node) => acc + (node.kind === 'folder' ? 0 : fileSize(node)), 0),
      trash: list.filter((node) => node.trashed).length,
    };
  }, [nodes]);

  const exportData = async () => {
    setBusy(true);
    try {
      const backup = await createBackup();
      downloadText(
        `nova-linux-backup-${new Date().toISOString().slice(0, 10)}.json`,
        backupToJson(backup),
        'application/json',
      );
      notifySuccess(t('Backup downloaded'), `${backup.files.length} files · v${backup.version}`);
    } catch (error) {
      notifyError(t('Invalid backup file'), error instanceof Error ? error.message : '');
    } finally {
      setBusy(false);
    }
  };

  const importData = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      await restoreBackup(backup);
      notifySuccess(t('Backup restored'), `${backup.files.length} files`);
    } catch (error) {
      notifyError(t('Invalid backup file'), error instanceof Error ? error.message : '');
    } finally {
      setBusy(false);
    }
  };

  const pickWallpaper = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      notifyError(t('Choose image'), t('Please select a PNG, JPG or WEBP image.'));
      return;
    }
    try {
      // Re-encoded in a canvas so a 6 MB photo does not fill LocalStorage.
      const dataUrl = await compressImage(file);
      set('customWallpaper', dataUrl);
      set('wallpaper', 'custom');
      notifySuccess(t('Wallpaper updated'), `${file.name} · ${formatBytes(dataUrl.length)}`);
    } catch {
      notifyError(t('That image could not be used'), t('Try a JPG or PNG under 8 MB.'));
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notifyError(t('Fullscreen'), 'Your browser blocked the fullscreen request.');
    }
  };

  const openReset = () => {
    setReport(profileReport());
    setResetOpen(true);
  };

  const confirmReset = async () => {
    await resetProfile();
    setResetOpen(false);
    setReport(null);
    notifySuccess(t('Profile reset'), t('Reloading the desktop with a clean profile…'));
    window.setTimeout(() => window.location.reload(), 700);
  };

  const usageList = usageRows(usageCounts, usageLast).slice(0, 6);
  const usageMax = usageList[0]?.count ?? 1;

  const renderSection = () => {
    switch (section) {
      case 'appearance':
        return (
          <>
            <SectionHeader title={t('Appearance')} description={t('Theme, accent colour and window styling for the whole desktop.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Themes')}</div>
                  <div className="settings-row__desc">{t('Choose how NOVA Linux looks.')}</div>
                </div>
                <Segmented
                  value={settings.theme}
                  onChange={(value) => set('theme', value)}
                  options={[
                    { value: 'kali', label: t('Kali'), icon: Terminal },
                    { value: 'dark', label: t('Dark Mode'), icon: Moon },
                    { value: 'light', label: t('Light Mode'), icon: Sun },
                  ]}
                />
              </div>
              <div className="settings-row settings-row--stack">
                <div className="settings-row__title">{t('Accent color')}</div>
                <div className="settings-swatches">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      className={cn('settings-swatch', settings.accent === accent.id && 'is-active')}
                      style={{ background: accent.color }}
                      onClick={() => set('accent', accent.id)}
                      title={accent.label}
                      aria-label={accent.label}
                    />
                  ))}
                </div>
              </div>
              <SliderRow
                label={t('Window transparency')}
                value={Math.round(settings.windowTransparency * 100)}
                min={70}
                max={100}
                onChange={(value) => set('windowTransparency', value / 100)}
                format={(value) => `${value}%`}
              />
              <SliderRow
                label={t('Corner radius')}
                value={settings.cornerRadius}
                min={0}
                max={26}
                onChange={(value) => set('cornerRadius', value)}
                format={(value) => `${value}px`}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Reduce motion')}</div>
                  <div className="settings-row__desc">{t('Uses minimal transitions across the desktop.')}</div>
                </div>
                <Toggle checked={settings.reduceMotion} onChange={(value) => set('reduceMotion', value)} label={t('Reduce motion')} />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Custom accent')}</div>
                  <div className="settings-row__desc">
                    {settings.customAccent
                      ? t('Theme studio colour in use: {color}', { color: settings.customAccent })
                      : t('Pick any colour to replace the preset accent.')}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    type="color"
                    className="settings-color"
                    aria-label={t('Custom accent')}
                    value={settings.customAccent ?? accentHex(settings.accent)}
                    onChange={(event) => set('customAccent', event.target.value)}
                  />
                  {settings.customAccent && (
                    <button className="btn btn--ghost btn--sm" onClick={() => set('customAccent', null)}>
                      <RotateCcw size={12} /> {t('Preset')}
                    </button>
                  )}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('System sounds')}</div>
                  <div className="settings-row__desc">
                    {t('Short synthesised feedback for opening, closing and notifications.')}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--ghost btn--sm" onClick={previewSound}>
                    <Volume2 size={12} /> {t('Test')}
                  </button>
                  <Toggle checked={settings.sounds} onChange={(value) => set('sounds', value)} label={t('System sounds')} />
                </div>
              </div>
            </div>
          </>
        );

      case 'desktop':
        return (
          <>
            <SectionHeader title={t('Desktop & Panel')} description={t('Position and style the main panel. Preferences are stored locally.')} />
            <div className="settings-card">
              <div className="settings-row settings-row--stack">
                <div className="settings-row__title">{t('Panel position')}</div>
                <Segmented
                  value={settings.panelPosition}
                  onChange={(value: PanelPosition) => set('panelPosition', value)}
                  options={[
                    { value: 'bottom', label: t('Bottom') },
                    { value: 'top', label: t('Top') },
                    { value: 'left', label: t('Left') },
                    { value: 'right', label: t('Right') },
                  ]}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Panel size')}</div>
                  <div className="settings-row__desc">{t('Compact, normal or large.')}</div>
                </div>
                <Segmented
                  size="sm"
                  value={settings.panelSize}
                  onChange={(value) => set('panelSize', value)}
                  options={[
                    { value: 'compact', label: t('Compact') },
                    { value: 'normal', label: t('Normal') },
                    { value: 'large', label: t('Large') },
                  ]}
                />
              </div>
              <SliderRow
                label={t('Panel opacity')}
                value={Math.round(settings.panelOpacity * 100)}
                min={40}
                max={100}
                onChange={(value) => set('panelOpacity', value / 100)}
                format={(value) => `${value}%`}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Auto-hide panel')}</div>
                  <div className="settings-row__desc">{t('Move the pointer to the screen edge to reveal the panel.')}</div>
                </div>
                <Toggle checked={settings.panelAutoHide} onChange={(value) => set('panelAutoHide', value)} label={t('Auto-hide panel')} />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Show app names in panel')}</div>
                  <div className="settings-row__desc">{t('Display labels next to pinned apps.')}</div>
                </div>
                <Toggle checked={settings.dockShowLabels} onChange={(value) => set('dockShowLabels', value)} label={t('Show app names in panel')} />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Restore windows on reload')}</div>
                  <div className="settings-row__desc">
                    {t('Reopen the windows you had open, in the same places, the next time you load the desktop.')}
                  </div>
                </div>
                <Toggle
                  checked={settings.restoreWindows}
                  onChange={(value) => set('restoreWindows', value)}
                  label={t('Restore windows on reload')}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Mirror this session across tabs')}</div>
                  <div className="settings-row__desc">
                    {t('Two tabs of this site behave like two monitors: windows, theme and saved files stay in sync. Nothing leaves the browser.')}
                  </div>
                </div>
                <Toggle
                  checked={settings.crossTabSync}
                  onChange={(value) => set('crossTabSync', value)}
                  label={t('Mirror this session across tabs')}
                />
              </div>
            </div>
          </>
        );

      case 'display':
        return (
          <>
            <SectionHeader title={t('Display')} description={t('The simulated desktop canvas, interface scale and text size.')} />
            <div className="settings-card">
              <div className="settings-row settings-row--stack">
                <div className="settings-row__title">{t('Virtual resolution')}</div>
                <div className="settings-row__desc" style={{ marginBottom: 6 }}>
                  {t('This changes the size of the simulated desktop canvas, not your real display.')}
                </div>
                <Segmented
                  size="sm"
                  value={settings.virtualResolution}
                  onChange={(value) => set('virtualResolution', value)}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: '1280x720', label: '1280 × 720' },
                    { value: '1440x900', label: '1440 × 900' },
                    { value: '1920x1080', label: '1920 × 1080' },
                  ]}
                />
              </div>
              <SliderRow
                label={t('UI scale')}
                value={settings.uiScale}
                min={85}
                max={120}
                onChange={(value) => set('uiScale', value)}
                format={(value) => `${value}%`}
              />
              <SliderRow
                label={t('Text size')}
                value={settings.fontSize}
                min={90}
                max={115}
                onChange={(value) => set('fontSize', value)}
                format={(value) => `${value}%`}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Fullscreen')}</div>
                  <div className="settings-row__desc">{t('Enter fullscreen')}</div>
                </div>
                <button className="btn btn--sm" onClick={toggleFullscreen}>
                  {document.fullscreenElement ? t('Exit fullscreen') : t('Enter fullscreen')}
                </button>
              </div>
            </div>
          </>
        );

      case 'brightness':
        return (
          <>
            <SectionHeader title={t('Brightness')} description={t('Dim the simulated desktop. This does not change your monitor backlight.')} />
            <div className="settings-card">
              <SliderRow
                label={t('Brightness')}
                value={settings.brightness}
                onChange={(value) => set('brightness', value)}
                format={(value) => `${value}%`}
                icon={Sun}
              />
              <SliderRow
                label={t('Volume')}
                value={settings.volume}
                onChange={(value) => set('volume', value)}
                format={(value) => `${value}%`}
                icon={Volume2}
              />
              <div className="settings-preview" style={{ filter: `brightness(${Math.max(0.25, settings.brightness / 100)})` }}>
                <div className="settings-preview__bar" />
                <div className="settings-preview__text">{t('Preview')}</div>
              </div>
            </div>
          </>
        );

      case 'wallpapers':
        return (
          <>
            <SectionHeader title={t('Wallpapers')} description={t('Pick a background for the desktop and login screen.')} />
            <div className="wallpaper-grid">
              {WALLPAPERS.map((wallpaper) => (
                <button
                  key={wallpaper.id}
                  className={cn('wallpaper-card', settings.wallpaper === wallpaper.id && 'is-active')}
                  onClick={() => {
                    set('wallpaper', wallpaper.id);
                    notify(t('Wallpaper updated'), { body: wallpaper.name, kind: 'success' });
                  }}
                >
                  <span
                    className={cn('wallpaper-card__preview', wallpaperClass(wallpaper.id))}
                    style={
                      WALLPAPER_THUMBS[wallpaper.id]
                        ? {
                            backgroundImage: `url(${WALLPAPER_THUMBS[wallpaper.id]})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  />
                  <span className="wallpaper-card__name">{wallpaper.name}</span>
                  <span className="wallpaper-card__desc">{wallpaper.description}</span>
                </button>
              ))}
              {settings.customWallpaper && (
                <button
                  className={cn('wallpaper-card', settings.wallpaper === 'custom' && 'is-active')}
                  onClick={() => set('wallpaper', 'custom')}
                >
                  <span
                    className="wallpaper-card__preview"
                    style={{ backgroundImage: `url(${settings.customWallpaper})`, backgroundSize: 'cover' }}
                  />
                  <span className="wallpaper-card__name">{t('Custom image')}</span>
                  <span className="wallpaper-card__desc">{t('Choose image')}</span>
                </button>
              )}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn" onClick={() => wallpaperRef.current?.click()}>
                <Upload size={14} /> {t('Choose image')}
              </button>
              {settings.wallpaper === 'custom' && (
                <button
                  className="btn"
                  onClick={() => {
                    set('wallpaper', 'wallpaper-kali');
                    set('customWallpaper', null);
                  }}
                >
                  <RotateCcw size={14} /> {t('Reset to default')}
                </button>
              )}
              <span className="tiny faint">{t('Images up to 8 MB are accepted; they are resized to 1920 px and stored in this browser only.')}</span>
            </div>
            <input
              ref={wallpaperRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickWallpaper(file);
                event.target.value = '';
              }}
            />
            <div className="settings-card" style={{ marginTop: 14 }}>
              <div className="settings-row__title">{t('Layering')}</div>
              <div className="settings-row__desc">
                {t('Dim and blur the wallpaper behind your windows. You can also drop an image file straight onto the desktop.')}
              </div>
              <SliderRow
                label={t('Wallpaper dim')}
                value={settings.wallpaperDim}
                min={0}
                max={80}
                onChange={(value) => set('wallpaperDim', value)}
                format={(value) => `${value}%`}
                icon={Sun}
              />
              <SliderRow
                label={t('Wallpaper blur')}
                value={settings.wallpaperBlur}
                min={0}
                max={20}
                onChange={(value) => set('wallpaperBlur', value)}
                format={(value) => `${value}px`}
                icon={SlidersHorizontal}
              />
              <div className="settings-note">
                {t('Drag & drop: any PNG, JPG or WEBP image dropped on the desktop becomes the wallpaper. It is resized to 1920 px and stored in this browser only.')}
              </div>
            </div>
          </>
        );

      case 'fonts':
        return (
          <>
            <SectionHeader title={t('Fonts')} description="Inter for Latin, Vazirmatn for Persian. Both ship with the app and work offline." />
            <div className="settings-card">
              <div className="font-sample" style={{ fontFamily: 'var(--font-ui)' }}>
                <div className="font-sample__label">Inter Variable</div>
                <div className="font-sample__text">The quick brown fox jumps over the lazy dog — 0123456789</div>
              </div>
              <div className="font-sample" style={{ direction: 'rtl' }}>
                <div className="font-sample__label">Vazirmatn Variable</div>
                <div className="font-sample__text">سرعت و دقت در محیط کاربری — ۰۱۲۳۴۵۶۷۸۹</div>
              </div>
              <SliderRow
                label={t('Text size')}
                value={settings.fontSize}
                min={90}
                max={115}
                onChange={(value) => set('fontSize', value)}
                format={(value) => `${value}%`}
              />
            </div>
          </>
        );

      case 'keyboard':
        return (
          <>
            <SectionHeader title={t('Keyboard')} description={t('Layout selection is simulated for this demo session.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Keyboard layout')}</div>
                  <div className="settings-row__desc">{t('Used by the login screen and shown here for reference.')}</div>
                </div>
                <select
                  className="select"
                  style={{ width: 200 }}
                  value={settings.keyboardLayout}
                  onChange={(event) => set('keyboardLayout', event.target.value as SettingsState['keyboardLayout'])}
                >
                  {KEYBOARD_LAYOUTS.map((layout) => (
                    <option key={layout.value} value={layout.value}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-note">
                {t('Shortcuts')}: Ctrl/Cmd + K — {t('Applications')} · Ctrl + Alt + T — {t('Terminal')} · Alt + Tab — {t('switch windows')} · Esc — {t('Close')}
              </div>
            </div>
          </>
        );

      case 'language':
        return (
          <>
            <SectionHeader title={t('Language & Region')} description={t('The whole desktop switches language and text direction.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Language')}</div>
                  <div className="settings-row__desc">{t('Right-to-left layout')}: fa</div>
                </div>
                <Segmented
                  value={settings.language}
                  onChange={(value: Language) => set('language', value)}
                  options={[
                    { value: 'en', label: 'English', icon: Globe },
                    { value: 'fa', label: 'فارسی', icon: Languages },
                  ]}
                />
              </div>
              <div className="settings-note">
                {t('After changing the language, menus, dates and app titles switch immediately. Numbers in the accounting app always use the Persian locale.')}
              </div>
            </div>
          </>
        );

      case 'datetime':
        return (
          <>
            <SectionHeader title={t('Date & Time')} description={t('Clock format for the panel and apps.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('24-hour clock')}</div>
                  <div className="settings-row__desc">14:05 vs 02:05 PM</div>
                </div>
                <Toggle checked={settings.clock24h} onChange={(value) => set('clock24h', value)} label={t('24-hour clock')} />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Show seconds')}</div>
                  <div className="settings-row__desc">{t('Adds seconds to the panel clock.')}</div>
                </div>
                <Toggle checked={settings.showSeconds} onChange={(value) => set('showSeconds', value)} label={t('Show seconds')} />
              </div>
              <div className="settings-note">
                {t('The clock follows your device time zone. There is no server time in this simulator.')}
              </div>
            </div>
          </>
        );

      case 'notifications':
        return (
          <>
            <SectionHeader title={t('Notifications')} description={t('Control in-desktop notifications.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Notifications enabled')}</div>
                  <div className="settings-row__desc">{t('Turn all simulator notifications on or off.')}</div>
                </div>
                <Toggle
                  checked={notificationsEnabled}
                  onChange={(value) => set('notificationsEnabled', value)}
                  label={t('Notifications')}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Do Not Disturb')}</div>
                  <div className="settings-row__desc">{t('Silence toast pop-ups, keep the history.')}</div>
                </div>
                <Toggle checked={settings.dnd} onChange={(value) => set('dnd', value)} label={t('Do Not Disturb')} />
              </div>
              <button
                className="btn btn--sm"
                onClick={() => {
                  useNotifications.getState().clearAll();
                  notifySuccess(t('Notifications'), t('Clear all'));
                }}
              >
                {t('Clear all')}
              </button>
            </div>
          </>
        );

      case 'storage':
        return (
          <>
            <SectionHeader title={t('Storage')} description={t('Your data lives in this browser (IndexedDB). Nothing is uploaded.')} />
            {storageWarning && (
              <div className="settings-note" style={{ borderColor: 'rgba(242,182,76,0.4)' }}>
                {t('Browser storage is unavailable. Changes will only last until you close this tab.')}
              </div>
            )}
            <div className="settings-card">
              <div className="settings-stats">
                <div>
                  <span className="settings-stat__value">{fileStats.files}</span>
                  <span className="settings-stat__label">{t('Files')}</span>
                </div>
                <div>
                  <span className="settings-stat__value">{fileStats.folders}</span>
                  <span className="settings-stat__label">{t('Folders')}</span>
                </div>
                <div>
                  <span className="settings-stat__value">{formatBytes(fileStats.bytes)}</span>
                  <span className="settings-stat__label">{t('Content size')}</span>
                </div>
                <div>
                  <span className="settings-stat__value">{usage ? formatBytes(usage.usage) : '—'}</span>
                  <span className="settings-stat__label">{t('Storage used')}</span>
                </div>
              </div>
              <div className="settings-meter">
                <span style={{ width: `${usage && usage.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 4}%` }} />
              </div>
              <div className="settings-note">{t('Your files are stored in IndexedDB on this device. They are never uploaded to a server and are not synced between devices.')}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn--primary" onClick={exportData} disabled={busy}>
                  <Download size={14} /> {t('Export User Data')}
                </button>
                <button className="btn" onClick={() => filePickerRef.current?.click()} disabled={busy}>
                  <Upload size={14} /> {t('Import User Data')}
                </button>
                <input
                  ref={filePickerRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importData(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="settings-card settings-card--danger">
              <div className="settings-row__title" style={{ color: 'var(--danger)' }}>
                {t('Danger zone')}
              </div>
              <p className="settings-row__desc">{t('This will delete all files, documents and settings stored in this browser.')}</p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn--danger" onClick={() => setConfirm('clear-demo')}>
                  {t('Clear Demo Data')}
                </button>
                <button className="btn btn--danger" onClick={openReset}>
                  {t('Reset this browser profile')}
                </button>
              </div>
              <p className="settings-row__desc">{t('Review exactly what will be erased before anything is deleted.')}</p>
            </div>
          </>
        );

      case 'privacy':
        return (
          <>
            <SectionHeader title={t('Privacy')} description={t('Everything stays in this browser.')} />
            <div className="settings-card">
              <ul className="settings-list">
                <li>{t('No account is required and no password is stored.')}</li>
                <li>{t('No analytics, tracking pixels or third-party services are loaded.')}</li>
                <li>{t('Files, notes and accounting records are stored in IndexedDB for this origin only.')}</li>
                <li>{t('The Browser app loads external pages directly in an iframe — those sites see your IP address as usual.')}</li>
                <li>{t('Clearing your browser data removes the simulator state permanently.')}</li>
              </ul>
              <div className="settings-note">
                {t('Data stored only in this browser')}
              </div>
            </div>
          </>
        );

      case 'accessibility':
        return (
          <>
            <SectionHeader title={t('Accessibility')} description={t('Comfort options for motion, size and contrast.')} />
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Reduce motion')}</div>
                  <div className="settings-row__desc">{t('Disables window, menu and boot animations.')}</div>
                </div>
                <Toggle checked={settings.reduceMotion} onChange={(value) => set('reduceMotion', value)} label={t('Reduce motion')} />
              </div>
              <SliderRow
                label={t('Text size')}
                value={settings.fontSize}
                min={90}
                max={115}
                onChange={(value) => set('fontSize', value)}
                format={(value) => `${value}%`}
              />
              <SliderRow
                label={t('UI scale')}
                value={settings.uiScale}
                min={85}
                max={120}
                onChange={(value) => set('uiScale', value)}
                format={(value) => `${value}%`}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('High contrast')}</div>
                  <div className="settings-row__desc">
                    {t('Boosts text and border contrast and thickens every outline.')}
                  </div>
                </div>
                <Toggle checked={settings.highContrast} onChange={(value) => set('highContrast', value)} label={t('High contrast')} />
              </div>
              <SliderRow
                label={t('Screensaver after')}
                value={settings.screensaverMinutes}
                min={0}
                max={30}
                onChange={(value) => set('screensaverMinutes', value)}
                format={(value) => (value === 0 ? t('Off') : t('{n} min', { n: value }))}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row__title">{t('Keyboard shortcuts')}</div>
                  <div className="settings-row__desc">{t('Every shell shortcut in one list.')}</div>
                </div>
                <button className="btn btn--sm" onClick={() => useShell.getState().openOverlay('shortcuts')}>
                  <Keyboard size={13} /> {t('Show list')}
                </button>
              </div>
              <div className="settings-note">
                {t('Keyboard focus rings are always visible. All dialogs close with the Escape key.')}
              </div>
            </div>
          </>
        );

      case 'about':
      default:
        return (
          <>
            <SectionHeader title={t('About')} description={t('About this simulator')} />
            <div className="settings-card about">
              <div className="about__head">
                <NovaLogo size={56} />
                <div>
                  <h2 className="about__title">NOVA Linux</h2>
                  <div className="small muted">Web Desktop Experience · {t('Simulator version')} 1.0.0</div>
                </div>
              </div>
              <p className="small muted" style={{ lineHeight: 1.7 }}>
                {t('NOVA Linux is a web-based desktop experience. It does not run a real Linux kernel; every system service, file and process you see is simulated in your browser.')}
              </p>
              <div className="about__grid">
                <div>
                  <div className="settings-row__title">{t('Technologies')}</div>
                  <ul className="settings-list">
                    <li>React + TypeScript</li>
                    <li>Vite</li>
                    <li>Zustand</li>
                    <li>Framer Motion</li>
                    <li>Lucide icons</li>
                    <li>IndexedDB · localStorage</li>
                  </ul>
                </div>
                <div>
                  <div className="settings-row__title">{t('Limitations')}</div>
                  <ul className="settings-list">
                    <li>No real kernel, processes or hardware access.</li>
                    <li>Network, battery and brightness are simulations.</li>
                    <li>Embedded websites may refuse to load in an iframe.</li>
                    <li>Data is local to this browser and origin.</li>
                    <li>DOCX import/export is not supported.</li>
                  </ul>
                </div>
              </div>
              <div className="settings-note">
                {t('Built as an open, front-end-only project. No backend, no API keys, no analytics.')}
              </div>
              <div className="about-usage">
                <div className="settings-row__title">
                  {t('Your usage on this device')}
                  <span className="faint tiny" style={{ marginInlineStart: 8 }}>
                    {t('{n} app launches · local only', { n: usageTotal })}
                  </span>
                </div>
                {usageList.length === 0 ? (
                  <p className="settings-row__desc">{t('No launches recorded yet. Counters never leave this browser.')}</p>
                ) : (
                  <ul className="usage-list">
                    {usageList.map((row) => (
                      <li key={row.appId}>
                        <span className="usage-list__name">{t(APP_META[row.appId]?.name ?? row.appId)}</span>
                        <span className="usage-list__bar" aria-hidden>
                          <span style={{ width: `${Math.max(6, (row.count / usageMax) * 100)}%` }} />
                        </span>
                        <span className="usage-list__count numeric">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button className="btn btn--ghost btn--sm" onClick={resetUsage} disabled={usageTotal === 0}>
                    <RotateCcw size={13} /> {t('Clear counters')}
                  </button>
                  <span className="tiny faint">{t('Stored in localStorage as nova-linux.usage.v1 — nothing is transmitted.')}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={reset}>
                  <RotateCcw size={14} /> {t('Reset to default')}
                </button>
                <button className="btn btn--ghost" onClick={() => useWindows.getState().openApp('welcome')}>
                  <Info size={14} /> {t('Start tour')}
                </button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="app settings-app">
      <aside className="settings-app__nav">
        <div className="settings-app__search">
          <SlidersHorizontal size={13} />
          <span className="small faint">NOVA Linux 1.0</span>
        </div>
        {SECTIONS.map((group) => (
          <div key={group.group} className="settings-app__group">
            <div className="settings-app__group-title">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn('settings-app__nav-item', section === item.id && 'is-active')}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={15} />
                  <span className="truncate">{t(item.label)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <main className="settings-app__content">{renderSection()}</main>

      <ConfirmDialog
        open={confirm === 'clear-demo'}
        title={t('Clear Demo Data')}
        message={`${t('This will delete all files, documents and settings stored in this browser.')} ${t('This action cannot be undone.')}`}
        confirmLabel={t('Clear Demo Data')}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void clearDemoData().then(() => {
            setConfirm(null);
            notifySuccess(t('Clear Demo Data'), t('Demo data restored'));
          });
        }}
      />
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('Reset this browser profile')}
        icon={<Shield size={16} />}
        footer={
          <>
            <button className="btn" onClick={() => setResetOpen(false)}>
              {t('Cancel')}
            </button>
            <button className="btn btn--danger" onClick={() => void confirmReset()}>
              {t('Delete everything and reload')}
            </button>
          </>
        }
      >
        {report && (
          <>
            <p className="settings-row__desc" style={{ marginTop: 0 }}>
              {t('Everything below lives in this browser only. This is exactly what will be deleted:')}
            </p>
            <ul className="reset-list">
              {[
                [t('Files'), report.files],
                [t('Folders'), report.folders],
                [t('Items in Trash'), report.trashed],
                [t('Notes'), report.notes],
                [t('Documents'), report.documents],
                [t('Spreadsheets'), report.spreadsheets],
                [t('Presentations'), report.presentations],
                [t('Images'), report.images],
                [t('Desktop icons'), report.desktopIcons],
                [t('Pinned apps'), report.pinnedApps],
                [t('Notifications'), report.notifications],
                [t('Saved wallpaper'), report.hasWallpaper ? 1 : 0],
                [t('Restored window session'), report.hasSession ? 1 : 0],
                [t('App launch counters'), report.usageRecords],
                [t('Stored keys'), report.localKeys],
              ].map(([label, value]) => (
                <li key={String(label)}>
                  <span>{label}</span>
                  <span className={cn('numeric', Number(value) === 0 && 'faint')}>{value}</span>
                </li>
              ))}
            </ul>
            <div className="settings-note" style={{ borderColor: 'rgba(239,71,111,0.4)' }}>
              {t('Preferences, files, app data and counters are removed. The desktop reloads with the original demo content. This cannot be undone — export a backup first if you want to keep anything.')}
            </div>
          </>
        )}
      </Modal>

    </div>
  );
}
