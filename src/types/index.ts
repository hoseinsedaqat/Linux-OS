/**
 * Shared domain types for NOVA Linux.
 * Everything here is a client-side simulation model — no real OS concepts leak in.
 */

export type AppId =
  | 'files'
  | 'browser'
  | 'writer'
  | 'calc'
  | 'impress'
  | 'notes'
  | 'accounting'
  | 'settings'
  | 'terminal'
  | 'calculator'
  | 'calendar'
  | 'software'
  | 'monitor'
  | 'trash'
  | 'welcome'
  | 'games'
  | 'minesweeper'
  | 'game2048'
  | 'snake'
  | 'tictactoe'
  | 'music'
  | 'photos'
  | 'weather';

export type Language = 'en' | 'fa';
export type ThemeMode = 'dark' | 'light';
export type PanelPosition = 'bottom' | 'top' | 'left' | 'right';

export interface AppDefinition {
  id: AppId;
  name: string;
  description: string;
  category:
    | 'Internet'
    | 'Office'
    | 'Graphics'
    | 'Multimedia'
    | 'System'
    | 'Utilities'
    | 'Development'
    | 'Games'
    | 'Favorites';
  icon: string;
  color: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  pinned?: boolean;
  singleton?: boolean;
  /** IDs of apps that are installed by the Software Center by default. */
  installed?: boolean;
  /** Hidden from the app grid (used for internal windows such as Trash). */
  hidden?: boolean;
}

/* ------------------------------------------------------------------ */
/* Virtual file system                                                 */
/* ------------------------------------------------------------------ */

export type FSNodeKind =
  | 'folder'
  | 'text'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'note'
  | 'image'
  | 'archive'
  | 'binary';

export interface FSNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: FSNodeKind;
  /** Text content or a JSON string depending on `kind`. */
  content: string;
  createdAt: number;
  modifiedAt: number;
  /** System nodes are part of the simulated image and cannot be trashed. */
  system?: boolean;
  trashed?: boolean;
  trashedFrom?: string | null;
  starred?: boolean;
  deletedAt?: number;
  /** Optional metadata for note colours, pinning, slide themes, etc. */
  meta?: Record<string, unknown>;
}

export interface FileMeta {
  size: number;
  extension: string;
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPayload {
  /** File path to open inside an editor app. */
  path?: string;
  /** Route / section to open inside an app (e.g. Settings > Appearance). */
  section?: string;
  /** New untitled document request. */
  untitled?: boolean;
  /** Generic search term. */
  query?: string;
  /** Open a specific accounting tab. */
  tab?: string;
  folderPath?: string;
  /** yyyy-mm-dd used by the calendar app. */
  date?: string;
}

export type SnapMode = 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WindowInstance extends WindowRect {
  id: string;
  appId: AppId;
  title: string;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  restoreRect?: WindowRect;
  payload?: WindowPayload;
  createdAt: number;
  /** True while the open animation plays. */
  opening?: boolean;
  /** Virtual desktop (1-based) the window lives on. */
  workspace?: number;
  /** Set while the window is tiled to a screen edge. */
  snapped?: SnapMode;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface SettingsState {
  language: Language;
  theme: ThemeMode;
  accent: 'mint' | 'sky' | 'violet' | 'amber' | 'rose';
  /** Optional hex accent overriding the preset palette (theme studio). */
  customAccent?: string | null;
  wallpaper: string;
  customWallpaper?: string | null;
  brightness: number;
  volume: number;
  panelPosition: PanelPosition;
  panelOpacity: number;
  panelSize: 'compact' | 'normal' | 'large';
  panelAutoHide: boolean;
  reduceMotion: boolean;
  /** Short Web Audio feedback sounds for shell actions. */
  sounds: boolean;
  /** Boosts contrast and thickens focus rings for accessibility. */
  highContrast: boolean;
  /** Minutes of inactivity before the screensaver appears (0 = off). */
  screensaverMinutes: number;
  uiScale: number;
  fontSize: number;
  cornerRadius: number;
  windowTransparency: number;
  showSeconds: boolean;
  clock24h: boolean;
  wifi: boolean;
  bluetooth: boolean;
  dnd: boolean;
  skipBoot: boolean;
  notificationsEnabled: boolean;
  keyboardLayout: 'us' | 'uk' | 'de' | 'ir';
  virtualResolution: 'auto' | '1280x720' | '1440x900' | '1920x1080';
  dockShowLabels: boolean;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  appId?: AppId;
  createdAt: number;
  kind: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
}

/* ------------------------------------------------------------------ */
/* Browser                                                             */
/* ------------------------------------------------------------------ */

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  pinned?: boolean;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
}

export interface BrowserTab {
  id: string;
  history: string[];
  historyIndex: number;
  title: string;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  time?: string;
  color: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Accounting                                                          */
/* ------------------------------------------------------------------ */

export interface AccountingParty {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: number;
}

export interface AccountingProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  taxRate: number;
}

export interface InvoiceLine {
  id: string;
  productId?: string;
  description: string;
  qty: number;
  price: number;
  discount: number;
}

export interface Invoice {
  id: string;
  number: string;
  type: 'sale' | 'purchase';
  partyId: string;
  date: string;
  dueDate?: string;
  lines: InvoiceLine[];
  taxRate: number;
  status: 'paid' | 'partial' | 'unpaid';
  paid: number;
  notes?: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  kind: 'income' | 'expense';
  title: string;
  amount: number;
  date: string;
  category: string;
  method: 'cash' | 'card' | 'transfer' | 'cheque';
  notes?: string;
  partyId?: string;
  createdAt: number;
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  balance: number;
  accountNumber: string;
}

export interface AccountingData {
  parties: { customers: AccountingParty[]; suppliers: AccountingParty[] };
  products: AccountingProduct[];
  invoices: Invoice[];
  transactions: Transaction[];
  banks: BankAccount[];
  settings: {
    businessName: string;
    taxRate: number;
    currency: string;
    sampleData: boolean;
    language: 'fa' | 'en';
  };
}
