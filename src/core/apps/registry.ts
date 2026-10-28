import { lazy, type ComponentType } from 'react';
import type { AppId } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';

/**
 * Every application is loaded on demand: the boot bundle only carries the
 * desktop shell, and opening an app fetches its chunk. The `default` mapping is
 * required because the app modules use named exports.
 */
const lazyApp = <T extends Record<string, ComponentType<AppWindowProps>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((module) => ({ default: module[name] })));

const FilesApp = lazyApp(() => import('@/apps/files/FilesApp'), 'FilesApp');
const BrowserApp = lazyApp(() => import('@/apps/browser/BrowserApp'), 'BrowserApp');
const WriterApp = lazyApp(() => import('@/apps/writer/WriterApp'), 'WriterApp');
const CalcApp = lazyApp(() => import('@/apps/calc/CalcApp'), 'CalcApp');
const ImpressApp = lazyApp(() => import('@/apps/impress/ImpressApp'), 'ImpressApp');
const NotesApp = lazyApp(() => import('@/apps/notes/NotesApp'), 'NotesApp');
const AccountingApp = lazyApp(() => import('@/apps/accounting/AccountingApp'), 'AccountingApp');
const SettingsApp = lazyApp(() => import('@/apps/settings/SettingsApp'), 'SettingsApp');
const TerminalApp = lazyApp(() => import('@/apps/terminal/TerminalApp'), 'TerminalApp');
const CalculatorApp = lazyApp(() => import('@/apps/calculator/CalculatorApp'), 'CalculatorApp');
const CalendarApp = lazyApp(() => import('@/apps/calendar/CalendarApp'), 'CalendarApp');
const SoftwareCenterApp = lazyApp(() => import('@/apps/software-center/SoftwareCenterApp'), 'SoftwareCenterApp');
const SystemMonitorApp = lazyApp(() => import('@/apps/system-monitor/SystemMonitorApp'), 'SystemMonitorApp');
const WelcomeApp = lazyApp(() => import('@/apps/welcome/WelcomeApp'), 'WelcomeApp');
const GamesApp = lazyApp(() => import('@/apps/games/GamesApp'), 'GamesApp');
const MinesweeperApp = lazyApp(() => import('@/apps/games/MinesweeperApp'), 'MinesweeperApp');
const Game2048App = lazyApp(() => import('@/apps/games/Game2048App'), 'Game2048App');
const SnakeApp = lazyApp(() => import('@/apps/games/SnakeApp'), 'SnakeApp');
const TicTacToeApp = lazyApp(() => import('@/apps/games/TicTacToeApp'), 'TicTacToeApp');
const CodeApp = lazyApp(() => import('@/apps/code/CodeApp'), 'CodeApp');
const MusicApp = lazyApp(() => import('@/apps/music/MusicApp'), 'MusicApp');
const PhotosApp = lazyApp(() => import('@/apps/photos/PhotosApp'), 'PhotosApp');
const WeatherApp = lazyApp(() => import('@/apps/weather/WeatherApp'), 'WeatherApp');

/**
 * The single place where app ids map to components.
 * Adding an app only requires a new folder + an entry here (and metadata in appMeta).
 */
export const APP_COMPONENTS: Record<AppId, ComponentType<AppWindowProps>> = {
  files: FilesApp,
  browser: BrowserApp,
  writer: WriterApp,
  calc: CalcApp,
  impress: ImpressApp,
  notes: NotesApp,
  accounting: AccountingApp,
  settings: SettingsApp,
  terminal: TerminalApp,
  calculator: CalculatorApp,
  calendar: CalendarApp,
  software: SoftwareCenterApp,
  monitor: SystemMonitorApp,
  trash: FilesApp,
  welcome: WelcomeApp,
  games: GamesApp,
  minesweeper: MinesweeperApp,
  game2048: Game2048App,
  snake: SnakeApp,
  tictactoe: TicTacToeApp,
  code: CodeApp,
  music: MusicApp,
  photos: PhotosApp,
  weather: WeatherApp,
};
