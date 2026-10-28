import { useRef, useState } from 'react';
import {
  BarChart3,
  Banknote,
  Boxes,
  Building2,
  CreditCard,
  FileDown,
  FileUp,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Settings2,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import type { AccountingData } from '@/types';
import { usePersistedValue } from '@/core/persistence/kvStore';
import { downloadText } from '@/utils';
import { notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import { ConfirmDialog } from '@/components/common/Modal';
import {
  accountingStore,
  categoriesOf,
  clearAccounting,
  formatJalali,
  formatMoney,
  invoiceTotal,
  invoiceDue,
  monthlySeries,
  resetToSample,
  sampleAccounting,
  totals,
} from './accountingStore';
import {
  ACCOUNTING_TAB_KEYS,
  BanksPage,
  InvoicesPage,
  PartiesPage,
  PaymentsPage,
  ProductsPage,
  TransactionsPage,
  downloadInvoicesCsv,
  type AccountingTab,
} from './AccountingPages';
import { MonthlyChart, Money, SectionHead, StatCard } from './AccountingUi';
import { cn } from '@/utils';

const TABS: Array<{ id: AccountingTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { id: 'customers', label: 'مشتریان', icon: Users },
  { id: 'suppliers', label: 'تأمین‌کنندگان', icon: Building2 },
  { id: 'products', label: 'کالاها و خدمات', icon: Boxes },
  { id: 'sales', label: 'فاکتورهای فروش', icon: Receipt },
  { id: 'purchases', label: 'فاکتورهای خرید', icon: ShoppingCart },
  { id: 'income', label: 'درآمدها', icon: TrendingUp },
  { id: 'expenses', label: 'هزینه‌ها', icon: TrendingDown },
  { id: 'payments', label: 'پرداخت‌ها', icon: CreditCard },
  { id: 'banks', label: 'حساب‌های بانکی', icon: Wallet },
  { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
  { id: 'settings', label: 'تنظیمات', icon: Settings2 },
];

export function AccountingApp({ win }: AppWindowProps) {
  const [data, setData] = usePersistedValue(accountingStore);
  const initialTab = (win.payload?.tab as AccountingTab) || 'dashboard';
  const [tab, setTab] = useState<AccountingTab>(ACCOUNTING_TAB_KEYS.includes(initialTab) ? initialTab : 'dashboard');
  const [confirm, setConfirm] = useState<null | 'reset' | 'clear'>(null);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const update = (updater: (current: AccountingData) => AccountingData) => setData(updater);
  const stats = totals(data);
  const series = monthlySeries(data);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentInvoices = [...data.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const filteredTransactions = data.transactions.filter(
    (transaction) => (reportFrom ? transaction.date >= reportFrom : true) && (reportTo ? transaction.date <= reportTo : true),
  );
  const reportIncome = filteredTransactions.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const reportExpense = filteredTransactions.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);

  const incomeByCategory = categoriesOf(data, 'income')
    .map((category) => ({
      category,
      total: filteredTransactions.filter((item) => item.kind === 'income' && item.category === category).reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const expenseByCategory = categoriesOf(data, 'expense')
    .map((category) => ({
      category,
      total: filteredTransactions.filter((item) => item.kind === 'expense' && item.category === category).reduce((sum, item) => sum + item.amount, 0),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const exportBackup = () => {
    downloadText(
      `nova-accounting-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ app: 'nova-accounting', version: 1, data }, null, 2),
      'application/json',
    );
    notifySuccess('نسخه پشتیبان ساخته شد', `${data.invoices.length} فاکتور`);
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { app?: string; data?: AccountingData };
      if (parsed.app !== 'nova-accounting' || !parsed.data || !Array.isArray(parsed.data.invoices)) {
        throw new Error('ساختار فایل معتبر نیست');
      }
      const imported = parsed.data;
      const safe: AccountingData = {
        parties: {
          customers: imported.parties?.customers ?? [],
          suppliers: imported.parties?.suppliers ?? [],
        },
        products: imported.products ?? [],
        invoices: imported.invoices ?? [],
        transactions: imported.transactions ?? [],
        banks: imported.banks ?? [],
        settings: { ...sampleAccounting().settings, ...imported.settings, businessName: imported.settings?.businessName ?? 'کسب‌وکار من' },
      };
      setData(safe);
      notifySuccess('بازیابی انجام شد', `${safe.invoices.length} فاکتور`);
    } catch (error) {
      notifyError('فایل پشتیبان نامعتبر است', error instanceof Error ? error.message : '');
    }
  };

  const renderContent = () => {
    switch (tab) {
      case 'customers':
        return <PartiesPage data={data} update={update} kind="customers" />;
      case 'suppliers':
        return <PartiesPage data={data} update={update} kind="suppliers" />;
      case 'products':
        return <ProductsPage data={data} update={update} />;
      case 'sales':
        return <InvoicesPage data={data} update={update} type="sale" />;
      case 'purchases':
        return <InvoicesPage data={data} update={update} type="purchase" />;
      case 'income':
        return <TransactionsPage data={data} update={update} kind="income" />;
      case 'expenses':
        return <TransactionsPage data={data} update={update} kind="expense" />;
      case 'payments':
        return <PaymentsPage data={data} update={update} />;
      case 'banks':
        return <BanksPage data={data} update={update} />;

      case 'reports':
        return (
          <div className="acc-page">
            <SectionHead
              title="گزارش‌ها"
              description="گزارش درآمد و هزینه بر اساس بازه زمانی"
              action={
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--sm" onClick={() => downloadInvoicesCsv(data)}>
                    <FileDown size={13} /> CSV فاکتورها
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={() => {
                      const rows = [
                        ['دسته‌بندی', 'نوع', 'مبلغ'],
                        ...incomeByCategory.map((entry) => [entry.category, 'درآمد', entry.total]),
                        ...expenseByCategory.map((entry) => [entry.category, 'هزینه', entry.total]),
                      ];
                      downloadText(
                        `nova-accounting-report-${new Date().toISOString().slice(0, 10)}.csv`,
                        '\uFEFF' + rows.map((row) => row.join(',')).join('\n'),
                        'text/csv;charset=utf-8',
                      );
                      notifySuccess('خروجی CSV', 'گزارش دسته‌بندی');
                    }}
                  >
                    <FileDown size={13} /> CSV گزارش
                  </button>
                </div>
              }
            />

            <div className="acc-toolbar">
              <label className="field" style={{ width: 160 }}>
                <span className="field__label">از تاریخ</span>
                <input className="input input--sm" type="date" dir="ltr" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
              </label>
              <label className="field" style={{ width: 160 }}>
                <span className="field__label">تا تاریخ</span>
                <input className="input input--sm" type="date" dir="ltr" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
              </label>
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  setReportFrom('');
                  setReportTo('');
                }}
              >
                پاک کردن فیلتر
              </button>
            </div>

            <div className="acc-cards">
              <StatCard label="درآمد بازه" value={formatMoney(reportIncome)} tone="success" />
              <StatCard label="هزینه بازه" value={formatMoney(reportExpense)} tone="danger" />
              <StatCard label="تراز بازه" value={formatMoney(reportIncome - reportExpense)} tone={reportIncome - reportExpense >= 0 ? 'info' : 'warning'} />
              <StatCard
                label="فروش فاکتورها"
                value={formatMoney(data.invoices.filter((invoice) => invoice.type === 'sale').reduce((sum, invoice) => sum + invoiceTotal(invoice), 0))}
                tone="default"
              />
            </div>

            <MonthlyChart series={series} />

            <div className="acc-report-grid">
              <div className="acc-table-wrap">
                <div className="acc-report-title">درآمد بر اساس دسته‌بندی</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>دسته‌بندی</th>
                      <th>مبلغ</th>
                      <th>سهم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeByCategory.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="faint">
                          داده‌ای وجود ندارد
                        </td>
                      </tr>
                    ) : (
                      incomeByCategory.map((entry) => (
                        <tr key={entry.category}>
                          <td>{entry.category}</td>
                          <td>
                            <Money value={entry.total} />
                          </td>
                          <td className="faint">{reportIncome ? Math.round((entry.total / reportIncome) * 100) : 0}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="acc-table-wrap">
                <div className="acc-report-title">هزینه بر اساس دسته‌بندی</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>دسته‌بندی</th>
                      <th>مبلغ</th>
                      <th>سهم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseByCategory.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="faint">
                          داده‌ای وجود ندارد
                        </td>
                      </tr>
                    ) : (
                      expenseByCategory.map((entry) => (
                        <tr key={entry.category}>
                          <td>{entry.category}</td>
                          <td>
                            <Money value={entry.total} />
                          </td>
                          <td className="faint">{reportExpense ? Math.round((entry.total / reportExpense) * 100) : 0}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="acc-page">
            <SectionHead title="تنظیمات" description="اطلاعات کسب‌وکار، مالیات و پشتیبان‌گیری" action={
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--sm" onClick={exportBackup}>
                  <FileDown size={13} /> پشتیبان JSON
                </button>
                <button className="btn btn--sm" onClick={() => importRef.current?.click()}>
                  <FileUp size={13} /> بازیابی
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importBackup(file);
                    event.target.value = '';
                  }}
                />
              </div>
            } />

            <div className="acc-settings-card">
              <label className="field">
                <span className="field__label">نام کسب‌وکار</span>
                <input
                  className="input"
                  value={data.settings.businessName}
                  onChange={(event) =>
                    update((current) => ({ ...current, settings: { ...current.settings, businessName: event.target.value } }))
                  }
                />
              </label>
              <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
                <label className="field" style={{ width: 160 }}>
                  <span className="field__label">نرخ مالیات پیش‌فرض (%)</span>
                  <input
                    className="input numeric"
                    type="number"
                    min={0}
                    max={100}
                    value={data.settings.taxRate}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        settings: { ...current.settings, taxRate: Number(event.target.value) },
                      }))
                    }
                  />
                </label>
                <label className="field" style={{ width: 160 }}>
                  <span className="field__label">واحد پول</span>
                  <input className="input" value="تومان" disabled />
                </label>
                <span className="badge badge--accent">ذخیره خودکار فعال</span>
              </div>
            </div>

            <div className="acc-settings-card acc-settings-card--warn">
              <div className="row-between">
                <div>
                  <div className="acc-settings-title">داده‌های نمونه</div>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {data.settings.sampleData
                      ? 'این برنامه با داده‌های نمونه (Sample Data) شروع شده است. می‌توانید آن‌ها را پاک کنید.'
                      : 'در حال حاضر داده نمونه‌ای وجود ندارد؛ برنامه با اطلاعات واقعی شما کار می‌کند.'}
                  </p>
                </div>
                {data.settings.sampleData && <span className="badge badge--warning">Sample Data</span>}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn btn--sm" onClick={() => setConfirm('reset')}>
                  <RefreshCw size={13} /> بازنشانی به داده نمونه
                </button>
                <button className="btn btn--sm btn--danger" onClick={() => setConfirm('clear')}>
                  <Trash2 size={13} /> پاک کردن همه داده‌ها
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => downloadInvoicesCsv(data)}>
                  <FileDown size={13} /> CSV فاکتورها
                </button>
              </div>
            </div>

            <div className="acc-note">
              این برنامه یک ابزار محلی و شبیه‌سازی‌شده است و به‌عنوان سامانه حسابداری امن چندکاربره یا برای نگهداری داده‌های حساس
              مناسب نیست. اطلاعات فقط در همین مرورگر ذخیره می‌شود و همگام‌سازی بین دستگاه‌ها وجود ندارد.
            </div>
          </div>
        );

      case 'dashboard':
      default:
        return (
          <div className="acc-page">
            <SectionHead
              title="داشبورد"
              description={`نمای کلی ${data.settings.businessName} — همه اعداد از داده‌های ذخیره‌شده محاسبه می‌شوند.`}
              action={
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => setTab('sales')}>
                    <Receipt size={13} /> ثبت فاکتور
                  </button>
                  <button className="btn btn--sm" onClick={() => setTab('expenses')}>
                    <TrendingDown size={13} /> ثبت هزینه
                  </button>
                </div>
              }
            />

            <div className="acc-cards">
              <StatCard label="مجموع فروش" value={formatMoney(stats.salesTotal)} hint={`${data.invoices.filter((invoice) => invoice.type === 'sale').length} فاکتور فروش`} tone="success" icon={<TrendingUp size={16} />} />
              <StatCard label="مجموع هزینه‌ها" value={formatMoney(stats.expensesTotal)} hint={`${data.transactions.filter((item) => item.kind === 'expense').length} تراکنش هزینه`} tone="danger" icon={<TrendingDown size={16} />} />
              <StatCard label="دریافتی‌ها" value={formatMoney(stats.received)} hint="پرداخت مشتریان و درآمد ثبت‌شده" tone="info" icon={<Banknote size={16} />} />
              <StatCard label="پرداختی‌ها" value={formatMoney(stats.paid)} hint="پرداخت به تأمین‌کنندگان و هزینه‌ها" tone="warning" icon={<CreditCard size={16} />} />
              <StatCard label="مطالبات" value={formatMoney(stats.receivables)} hint="مانده فاکتورهای فروش" tone="default" />
              <StatCard label="بدهی‌ها" value={formatMoney(stats.payables)} hint="مانده فاکتورهای خرید" tone="default" />
            </div>

            <MonthlyChart series={series} />

            <div className="acc-report-grid">
              <div className="acc-table-wrap">
                <div className="acc-report-title">آخرین تراکنش‌ها</div>
                {recent.length === 0 ? (
                  <p className="small faint" style={{ padding: 14 }}>
                    تراکنشی ثبت نشده است.
                  </p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>تاریخ</th>
                        <th>عنوان</th>
                        <th>مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="faint small">{formatJalali(transaction.date)}</td>
                          <td>{transaction.title}</td>
                          <td className={transaction.kind === 'income' ? 'acc-income' : 'acc-expense'}>
                            {transaction.kind === 'income' ? '+' : '−'} <Money value={transaction.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="acc-table-wrap">
                <div className="acc-report-title">آخرین فاکتورها</div>
                {recentInvoices.length === 0 ? (
                  <p className="small faint" style={{ padding: 14 }}>
                    فاکتوری ثبت نشده است.
                  </p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>شماره</th>
                        <th>تاریخ</th>
                        <th>جمع کل</th>
                        <th>مانده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="mono">{invoice.number}</td>
                          <td className="faint small">{formatJalali(invoice.date)}</td>
                          <td>
                            <Money value={invoiceTotal(invoice)} />
                          </td>
                          <td className={invoiceDue(invoice) > 0 ? 'acc-due' : 'faint'}>
                            <Money value={invoiceDue(invoice)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="acc-note">
              شبیه‌ساز حسابداری NOVA — ابزار محلی. داده‌ها در IndexedDB همین مرورگر ذخیره می‌شوند.
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app accounting" dir="rtl">
      <aside className="acc-nav">
        <div className="acc-nav__brand">
          <span className="acc-nav__logo">
            <Wallet size={17} />
          </span>
          <div>
            <div className="acc-nav__title">NOVA Accounting</div>
            <div className="acc-nav__sub">{data.settings.businessName}</div>
          </div>
        </div>
        <nav className="acc-nav__list">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={cn('acc-nav__item', tab === item.id && 'is-active')}
                onClick={() => setTab(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.id === 'payments' && stats.receivables + stats.payables > 0 && <span className="acc-nav__dot" />}
              </button>
            );
          })}
        </nav>
        <div className="acc-nav__footer">
          {data.settings.sampleData && <span className="badge badge--warning">Sample Data</span>}
          <button className="btn btn--sm btn--ghost" onClick={exportBackup}>
            <FileDown size={12} /> پشتیبان
          </button>
        </div>
      </aside>

      <main className="acc-main">{renderContent()}</main>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="بازنشانی به داده نمونه"
        message="همه داده‌های فعلی با داده‌های نمونه جایگزین می‌شوند. ادامه می‌دهید؟"
        confirmLabel="بازنشانی"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          resetToSample();
          setConfirm(null);
          notifySuccess('داده نمونه بازنشانی شد', 'Sample Data');
        }}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        title="پاک کردن همه داده‌ها"
        message="همه مشتریان، فاکتورها، تراکنش‌ها و حساب‌ها حذف می‌شوند. این عملیات قابل بازگشت نیست."
        confirmLabel="پاک کردن"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          clearAccounting();
          setConfirm(null);
          notifySuccess('همه داده‌ها پاک شد', 'برنامه آماده ثبت اطلاعات جدید است');
        }}
      />
    </div>
  );
}
