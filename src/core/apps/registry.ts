import type { AppId } from '@/types';
import type { AppWindowProps } from '@/core/apps/types';
import { FilesApp } from '@/apps/files/FilesApp';
import { BrowserApp } from '@/apps/browser/BrowserApp';
import { WriterApp } from '@/apps/writer/WriterApp';
import { CalcApp } from '@/apps/calc/CalcApp';
import { ImpressApp } from '@/apps/impress/ImpressApp';
import { NotesApp } from '@/apps/notes/NotesApp';
import { AccountingApp } from '@/apps/accounting/AccountingApp';
import { SettingsApp } from '@/apps/settings/SettingsApp';
import { TerminalApp } from '@/apps/terminal/TerminalApp';
import { CalculatorApp } from '@/apps/calculator/CalculatorApp';
import { CalendarApp } from '@/apps/calendar/CalendarApp';
import { SoftwareCenterApp } from '@/apps/software-center/SoftwareCenterApp';
import { SystemMonitorApp } from '@/apps/system-monitor/SystemMonitorApp';
import { WelcomeApp } from '@/apps/welcome/WelcomeApp';

/**
 * The single place where app ids map to components.
 * Adding an app only requires a new folder + an entry here (and metadata in appMeta).
 */
export const APP_COMPONENTS: Record<AppId, React.ComponentType<AppWindowProps>> = {
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
};
