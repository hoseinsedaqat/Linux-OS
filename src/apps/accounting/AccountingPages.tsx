import { useState } from 'react';
import { Banknote, Edit3, Plus, Printer, Search, Trash2, Wallet } from 'lucide-react';
import type {
  AccountingData,
  AccountingParty,
  AccountingProduct,
  BankAccount,
  Invoice,
  InvoiceLine,
  Transaction,
} from '@/types';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';
import { notify, notifyError, notifySuccess } from '@/core/notifications/notificationsStore';
import { openPrintWindow } from '@/services/print';
import { downloadText, uid } from '@/utils';
import { cn } from '@/utils';
import {
  CURRENCY,
  categoriesOf,
  formatMoney,
  formatNumber,
  invoiceDue,
  invoiceStatus,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  lineTotal,
  nextNumber,
  todayIso,
} from './accountingStore';
import { AccEmpty, DateText, Money, SectionHead, StatCard, StatusBadge } from './AccountingUi';

export interface PageProps {
  data: AccountingData;
  update: (updater: (data: AccountingData) => AccountingData) => void;
}

/* ------------------------------------------------------------------ */
/* Parties (customers & suppliers)                                     */
/* ------------------------------------------------------------------ */

export function PartiesPage({ data, update, kind }: PageProps & { kind: 'customers' | 'suppliers' }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<AccountingParty | null>(null);
  const [confirm, setConfirm] = useState<AccountingParty | null>(null);
  const list = data.parties[kind];
  const title = kind === 'customers' ? 'مشتریان' : 'تأمین‌کنندگان';

  const related = (partyId: string) => {
    const invoices = data.invoices.filter((invoice) => invoice.partyId === partyId);
    return {
      count: invoices.length,
      total: invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0),
    };
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      notifyError('فیلد الزامی', 'نام را وارد کنید.');
      return;
    }
    if (!draft.phone.trim()) {
      notifyError('فیلد الزامی', 'شماره تماس را وارد کنید.');
      return;
    }
    update((current) => {
      const existing = current.parties[kind];
      const parties = existing.some((party) => party.id === draft.id)
        ? existing.map((party) => (party.id === draft.id ? draft : party))
        : [...existing, draft];
      return { ...current, parties: { ...current.parties, [kind]: parties } };
    });
    notifySuccess('ذخیره شد', draft.name);
    setDraft(null);
  };

  const filtered = list.filter(
    (party) => party.name.includes(query) || party.phone.includes(query) || (party.notes ?? '').includes(query),
  );

  return (
    <div className="acc-page">
      <SectionHead
        title={title}
        description={`مدیریت ${title} و سوابق مالی مرتبط`}
        action={
          <button
            className="btn btn--primary btn--sm"
            onClick={() =>
              setDraft({
                id: uid(kind === 'customers' ? 'cust' : 'supp'),
                name: '',
                phone: '',
                notes: '',
                createdAt: Date.now(),
              })
            }
          >
            <Plus size={14} /> {kind === 'customers' ? 'مشتری جدید' : 'تأمین‌کننده جدید'}
          </button>
        }
      />

      <div className="acc-toolbar">
        <div className="acc-search">
          <Search size={14} />
          <input
            className="input input--sm"
            placeholder={`جست‌وجو در ${title}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="grow" />
        <span className="badge">{list.length} مورد</span>
      </div>

      {filtered.length === 0 ? (
        <AccEmpty title="موردی ثبت نشده است" description={`هنوز ${title}ی ثبت نشده یا نتیجه‌ای برای جست‌وجو وجود ندارد.`} />
      ) : (
        <div className="acc-table-wrap">
          <table className="table acc-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>شماره تماس</th>
                <th>توضیحات</th>
                <th>تعداد فاکتور</th>
                <th>مجموع مبلغ</th>
                <th style={{ width: 96 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((party) => {
                const stats = related(party.id);
                return (
                  <tr key={party.id}>
                    <td className="acc-strong">{party.name}</td>
                    <td className="mono">{party.phone}</td>
                    <td className="faint small">{party.notes || '—'}</td>
                    <td>{formatNumber(stats.count)}</td>
                    <td>
                      <Money value={stats.total} />
                    </td>
                    <td>
                      <span className="row" style={{ gap: 2 }}>
                        <button className="icon-btn" onClick={() => setDraft(party)} title="ویرایش">
                          <Edit3 size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => setConfirm(party)} title="حذف">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft && list.some((party) => party.id === draft.id) ? 'ویرایش' : 'ثبت جدید'}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={save}>
              ذخیره
            </button>
          </>
        }
      >
        {draft && (
          <div className="col" style={{ gap: 12 }}>
            <label className="field">
              <span className="field__label">نام *</span>
              <input
                className="input"
                value={draft.name}
                autoFocus
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">شماره تماس *</span>
              <input
                className="input mono"
                dir="ltr"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">توضیحات</span>
              <textarea
                className="textarea"
                rows={3}
                value={draft.notes ?? ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="حذف مورد"
        message={`آیا از حذف «${confirm?.name ?? ''}» مطمئن هستید؟ فاکتورهای مرتبط بدون نام می‌مانند.`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          update((current) => ({
            ...current,
            parties: {
              ...current.parties,
              [kind]: current.parties[kind].filter((party) => party.id !== confirm.id),
            },
          }));
          notify('حذف شد', { body: confirm.name, kind: 'info' });
          setConfirm(null);
        }}
      />
      <span className="sr-only">{t('Accounting')}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products & services                                                 */
/* ------------------------------------------------------------------ */

export function ProductsPage({ data, update }: PageProps) {
  const [draft, setDraft] = useState<AccountingProduct | null>(null);
  const [confirm, setConfirm] = useState<AccountingProduct | null>(null);
  const [query, setQuery] = useState('');

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      notifyError('فیلد الزامی', 'نام کالا یا خدمت را وارد کنید.');
      return;
    }
    if (draft.price <= 0) {
      notifyError('مبلغ نامعتبر', 'قیمت باید بزرگ‌تر از صفر باشد.');
      return;
    }
    update((current) => ({
      ...current,
      products: current.products.some((product) => product.id === draft.id)
        ? current.products.map((product) => (product.id === draft.id ? draft : product))
        : [...current.products, draft],
    }));
    notifySuccess('ذخیره شد', draft.name);
    setDraft(null);
  };

  const filtered = data.products.filter((product) => product.name.includes(query));

  return (
    <div className="acc-page">
      <SectionHead
        title="کالاها و خدمات"
        description="اقلام قابل استفاده در فاکتورها"
        action={
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setDraft({ id: uid('prod'), name: '', price: 0, unit: 'عدد', taxRate: data.settings.taxRate })}
          >
            <Plus size={14} /> مورد جدید
          </button>
        }
      />
      <div className="acc-toolbar">
        <div className="acc-search">
          <Search size={14} />
          <input className="input input--sm" placeholder="جست‌وجو" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <span className="grow" />
        <span className="badge">{data.products.length} مورد</span>
      </div>
      {filtered.length === 0 ? (
        <AccEmpty title="کالایی ثبت نشده" description="برای استفاده در فاکتورها ابتدا کالا یا خدمت اضافه کنید." />
      ) : (
        <div className="acc-table-wrap">
          <table className="table acc-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>واحد</th>
                <th>قیمت واحد</th>
                <th>مالیات</th>
                <th style={{ width: 96 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td className="acc-strong">{product.name}</td>
                  <td>{product.unit}</td>
                  <td>
                    <Money value={product.price} />
                  </td>
                  <td>{product.taxRate}%</td>
                  <td>
                    <span className="row" style={{ gap: 2 }}>
                      <button className="icon-btn" onClick={() => setDraft(product)}>
                        <Edit3 size={14} />
                      </button>
                      <button className="icon-btn" onClick={() => setConfirm(product)}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft && data.products.some((product) => product.id === draft.id) ? 'ویرایش کالا' : 'کالای جدید'}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={save}>
              ذخیره
            </button>
          </>
        }
      >
        {draft && (
          <div className="col" style={{ gap: 12 }}>
            <label className="field">
              <span className="field__label">نام کالا یا خدمت *</span>
              <input className="input" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
              <label className="field grow">
                <span className="field__label">قیمت واحد ({CURRENCY}) *</span>
                <input
                  className="input numeric"
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
                />
              </label>
              <label className="field" style={{ width: 110 }}>
                <span className="field__label">واحد</span>
                <input className="input" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
              </label>
              <label className="field" style={{ width: 100 }}>
                <span className="field__label">مالیات %</span>
                <input
                  className="input numeric"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.taxRate}
                  onChange={(event) => setDraft({ ...draft, taxRate: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="حذف کالا"
        message={`آیا از حذف «${confirm?.name ?? ''}» مطمئن هستید؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          update((current) => ({ ...current, products: current.products.filter((product) => product.id !== confirm.id) }));
          notify('حذف شد', { body: confirm.name, kind: 'info' });
          setConfirm(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export function InvoicesPage({ data, update, type }: PageProps & { type: 'sale' | 'purchase' }) {
  const [draft, setDraft] = useState<Invoice | null>(null);
  const [confirm, setConfirm] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  const parties = type === 'sale' ? data.parties.customers : data.parties.suppliers;
  const title = type === 'sale' ? 'فاکتورهای فروش' : 'فاکتورهای خرید';

  const list = data.invoices
    .filter((invoice) => invoice.type === type)
    .filter((invoice) => (statusFilter === 'all' ? true : invoiceStatus(invoice) === statusFilter))
    .filter((invoice) => {
      if (!query.trim()) return true;
      const party = parties.find((item) => item.id === invoice.partyId);
      return invoice.number.includes(query) || (party?.name ?? '').includes(query) || invoice.date.includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const blankInvoice = (): Invoice => ({
    id: uid('inv'),
    number: nextNumber(data, type),
    type,
    partyId: parties[0]?.id ?? '',
    date: todayIso(),
    lines: [
      {
        id: uid('line'),
        description: '',
        qty: 1,
        price: 0,
        discount: 0,
      },
    ],
    taxRate: data.settings.taxRate,
    status: 'unpaid',
    paid: 0,
    createdAt: Date.now(),
  });

  const saveInvoice = () => {
    if (!draft) return;
    if (!draft.partyId) {
      notifyError('فیلد الزامی', type === 'sale' ? 'مشتری را انتخاب کنید.' : 'تأمین‌کننده را انتخاب کنید.');
      return;
    }
    if (draft.lines.length === 0 || draft.lines.some((line) => !line.description.trim() || line.qty <= 0 || line.price < 0)) {
      notifyError('اطلاعات ناقص', 'هر ردیف باید شرح، تعداد بزرگ‌تر از صفر و قیمت معتبر داشته باشد.');
      return;
    }
    if (!draft.date) {
      notifyError('فیلد الزامی', 'تاریخ فاکتور را وارد کنید.');
      return;
    }
    const total = invoiceTotal(draft);
    if (draft.paid > total) {
      notifyError('مبلغ نامعتبر', 'مبلغ پرداخت‌شده نمی‌تواند بیشتر از جمع کل باشد.');
      return;
    }
    const normalized: Invoice = { ...draft, status: invoiceStatus({ ...draft, paid: draft.paid }) };
    update((current) => ({
      ...current,
      invoices: current.invoices.some((invoice) => invoice.id === normalized.id)
        ? current.invoices.map((invoice) => (invoice.id === normalized.id ? normalized : invoice))
        : [...current.invoices, normalized],
    }));
    notifySuccess('فاکتور ذخیره شد', normalized.number);
    setDraft(null);
  };

  const registerPayment = () => {
    if (!payment) return;
    const due = invoiceDue(payment);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      notifyError('مبلغ نامعتبر', 'مبلغ پرداخت باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (paymentAmount > due) {
      notifyError('مبلغ نامعتبر', 'مبلغ پرداخت بیشتر از مانده فاکتور است.');
      return;
    }
    update((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === payment.id
          ? { ...invoice, paid: invoice.paid + paymentAmount, status: invoiceStatus({ ...invoice, paid: invoice.paid + paymentAmount }) }
          : invoice,
      ),
    }));
    notifySuccess('پرداخت ثبت شد', formatMoney(paymentAmount));
    setPayment(null);
  };

  const printInvoice = (invoice: Invoice) => {
    const party = parties.find((item) => item.id === invoice.partyId);
    const rows = invoice.lines
      .map(
        (line, index) =>
          `<tr><td>${index + 1}</td><td>${line.description}</td><td>${formatNumber(line.qty)}</td><td>${formatMoney(line.price)}</td><td>${formatMoney(line.discount)}</td><td>${formatMoney(lineTotal(line))}</td></tr>`,
      )
      .join('');
    const html = `<div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:18px">
        <div><h1 style="margin:0;font-size:22px">${data.settings.businessName}</h1>
        <div style="color:#555;font-size:12px">${title}</div></div>
        <div style="text-align:left;font-size:12px">
          <div>شماره: <strong>${invoice.number}</strong></div>
          <div>تاریخ: ${invoice.date}</div>
        </div>
      </div>
      <div style="margin-bottom:14px;font-size:13px">
        <div><strong>${type === 'sale' ? 'مشتری' : 'تأمین‌کننده'}:</strong> ${party?.name ?? '—'}</div>
        <div><strong>تماس:</strong> ${party?.phone ?? '—'}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f1f3f6">
          <th style="border:1px solid #ccc;padding:6px">#</th>
          <th style="border:1px solid #ccc;padding:6px">شرح</th>
          <th style="border:1px solid #ccc;padding:6px">تعداد</th>
          <th style="border:1px solid #ccc;padding:6px">قیمت واحد</th>
          <th style="border:1px solid #ccc;padding:6px">تخفیف</th>
          <th style="border:1px solid #ccc;padding:6px">جمع</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:left;font-size:13px;line-height:2">
        <div>جمع اقلام: ${formatMoney(invoiceSubtotal(invoice))}</div>
        <div>مالیات (${invoice.taxRate}%): ${formatMoney(invoiceTax(invoice))}</div>
        <div><strong>جمع کل: ${formatMoney(invoiceTotal(invoice))}</strong></div>
        <div>پرداخت‌شده: ${formatMoney(invoice.paid)}</div>
        <div>مانده: ${formatMoney(invoiceDue(invoice))}</div>
      </div>
      <p style="margin-top:26px;font-size:11px;color:#777">این فاکتور در شبیه‌ساز NOVA Linux ایجاد شده است.</p>
    </div>`;
    openPrintWindow(`${invoice.number} — ${data.settings.businessName}`, html, 'portrait');
  };

  return (
    <div className="acc-page">
      <SectionHead
        title={title}
        description="ثبت، ویرایش، دریافت پرداخت و چاپ فاکتور"
        action={
          <button className="btn btn--primary btn--sm" onClick={() => setDraft(blankInvoice())}>
            <Plus size={14} /> فاکتور جدید
          </button>
        }
      />

      <div className="acc-toolbar">
        <div className="acc-search">
          <Search size={14} />
          <input className="input input--sm" placeholder="جست‌وجو بر اساس شماره یا نام" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="row" style={{ gap: 4 }}>
          {(
            [
              { key: 'all', label: 'همه' },
              { key: 'paid', label: 'پرداخت‌شده' },
              { key: 'partial', label: 'جزئی' },
              { key: 'unpaid', label: 'پرداخت‌نشده' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              className={cn('chip', statusFilter === option.key && 'is-active')}
              onClick={() => setStatusFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <AccEmpty title="فاکتوری وجود ندارد" description="با دکمه «فاکتور جدید» اولین فاکتور را ثبت کنید." />
      ) : (
        <div className="acc-table-wrap">
          <table className="table acc-table">
            <thead>
              <tr>
                <th>شماره</th>
                <th>{type === 'sale' ? 'مشتری' : 'تأمین‌کننده'}</th>
                <th>تاریخ</th>
                <th>جمع کل</th>
                <th>پرداخت‌شده</th>
                <th>مانده</th>
                <th>وضعیت</th>
                <th style={{ width: 128 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((invoice) => {
                const party = parties.find((item) => item.id === invoice.partyId);
                const due = invoiceDue(invoice);
                return (
                  <tr key={invoice.id}>
                    <td className="acc-strong mono">{invoice.number}</td>
                    <td>{party?.name ?? <span className="faint">بدون نام</span>}</td>
                    <td>
                      <DateText date={invoice.date} />
                    </td>
                    <td>
                      <Money value={invoiceTotal(invoice)} />
                    </td>
                    <td>
                      <Money value={invoice.paid} />
                    </td>
                    <td className={cn(due > 0 && 'acc-due')}>
                      <Money value={due} />
                    </td>
                    <td>
                      <StatusBadge invoice={invoice} />
                    </td>
                    <td>
                      <span className="row" style={{ gap: 2 }}>
                        <button className="icon-btn" title="ویرایش" onClick={() => setDraft(invoice)}>
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          title="ثبت پرداخت"
                          disabled={due <= 0}
                          onClick={() => {
                            setPayment(invoice);
                            setPaymentAmount(due);
                          }}
                        >
                          <Banknote size={14} />
                        </button>
                        <button className="icon-btn" title="چاپ" onClick={() => printInvoice(invoice)}>
                          <Printer size={14} />
                        </button>
                        <button className="icon-btn" title="حذف" onClick={() => setConfirm(invoice)}>
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        wide
        title={draft && data.invoices.some((invoice) => invoice.id === draft.id) ? `ویرایش فاکتور ${draft.number}` : 'فاکتور جدید'}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={saveInvoice}>
              ذخیره فاکتور
            </button>
          </>
        }
      >
        {draft && (
          <div className="col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label className="field" style={{ minWidth: 200, flex: 1 }}>
                <span className="field__label">{type === 'sale' ? 'مشتری *' : 'تأمین‌کننده *'}</span>
                <select className="select" value={draft.partyId} onChange={(event) => setDraft({ ...draft, partyId: event.target.value })}>
                  <option value="">انتخاب کنید…</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ width: 170 }}>
                <span className="field__label">شماره فاکتور</span>
                <input className="input mono" value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} />
              </label>
              <label className="field" style={{ width: 160 }}>
                <span className="field__label">تاریخ *</span>
                <input className="input" type="date" dir="ltr" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </label>
              <label className="field" style={{ width: 120 }}>
                <span className="field__label">مالیات %</span>
                <input
                  className="input numeric"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.taxRate}
                  onChange={(event) => setDraft({ ...draft, taxRate: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="acc-lines">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 190 }}>شرح</th>
                    <th style={{ width: 90 }}>تعداد</th>
                    <th style={{ width: 140 }}>قیمت واحد</th>
                    <th style={{ width: 120 }}>تخفیف</th>
                    <th style={{ width: 130 }}>جمع</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          className="input input--sm"
                          value={item.description}
                          list="acc-products"
                          placeholder="شرح کالا یا خدمت"
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              lines: draft.lines.map((line) =>
                                line.id === item.id ? { ...line, description: event.target.value } : line,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input input--sm numeric"
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              lines: draft.lines.map((line) =>
                                line.id === item.id ? { ...line, qty: Number(event.target.value) } : line,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input input--sm numeric"
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              lines: draft.lines.map((line) =>
                                line.id === item.id ? { ...line, price: Number(event.target.value) } : line,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input input--sm numeric"
                          type="number"
                          min={0}
                          value={item.discount}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              lines: draft.lines.map((line) =>
                                line.id === item.id ? { ...line, discount: Number(event.target.value) } : line,
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="numeric">{formatMoney(lineTotal(item))}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => setDraft({ ...draft, lines: draft.lines.filter((line) => line.id !== item.id) })}
                          disabled={draft.lines.length === 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="acc-products">
                {data.products.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
              <button
                className="btn btn--sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    lines: [...draft.lines, { id: uid('line'), description: '', qty: 1, price: 0, discount: 0 } as InvoiceLine],
                  })
                }
              >
                <Plus size={13} /> افزودن ردیف
              </button>
            </div>

            <div className="acc-totals">
              <div>
                <span>جمع اقلام</span>
                <strong>{formatMoney(invoiceSubtotal(draft))}</strong>
              </div>
              <div>
                <span>مالیات</span>
                <strong>{formatMoney(invoiceTax(draft))}</strong>
              </div>
              <div className="acc-totals__grand">
                <span>جمع کل</span>
                <strong>{formatMoney(invoiceTotal(draft))}</strong>
              </div>
              <label className="field" style={{ width: 180 }}>
                <span className="field__label">پرداخت‌شده</span>
                <input
                  className="input input--sm numeric"
                  type="number"
                  min={0}
                  value={draft.paid}
                  onChange={(event) => setDraft({ ...draft, paid: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(payment)}
        onClose={() => setPayment(null)}
        title={`ثبت پرداخت — ${payment?.number ?? ''}`}
        footer={
          <>
            <button className="btn" onClick={() => setPayment(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={registerPayment}>
              ثبت پرداخت
            </button>
          </>
        }
      >
        {payment && (
          <div className="col" style={{ gap: 12 }}>
            <div className="row-between">
              <span className="muted">مانده فاکتور</span>
              <strong>{formatMoney(invoiceDue(payment))}</strong>
            </div>
            <label className="field">
              <span className="field__label">مبلغ پرداخت ({CURRENCY})</span>
              <input
                className="input numeric"
                type="number"
                min={1}
                max={invoiceDue(payment)}
                value={paymentAmount}
                autoFocus
                onChange={(event) => setPaymentAmount(Number(event.target.value))}
              />
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="حذف فاکتور"
        message={`فاکتور ${confirm?.number ?? ''} حذف شود؟ این عملیات قابل بازگشت نیست.`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          update((current) => ({ ...current, invoices: current.invoices.filter((invoice) => invoice.id !== confirm.id) }));
          notify('فاکتور حذف شد', { body: confirm.number, kind: 'info' });
          setConfirm(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transactions (income / expenses)                                    */
/* ------------------------------------------------------------------ */

export function TransactionsPage({ data, update, kind }: PageProps & { kind: 'income' | 'expense' }) {
  const [draft, setDraft] = useState<Transaction | null>(null);
  const [confirm, setConfirm] = useState<Transaction | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('all');

  const title = kind === 'income' ? 'درآمدها' : 'هزینه‌ها';
  const categories = categoriesOf(data, kind);

  const list = data.transactions
    .filter((transaction) => transaction.kind === kind)
    .filter((transaction) => (category === 'all' ? true : transaction.category === category))
    .filter((transaction) => (from ? transaction.date >= from : true))
    .filter((transaction) => (to ? transaction.date <= to : true))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = list.reduce((sum, transaction) => sum + transaction.amount, 0);

  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      notifyError('فیلد الزامی', 'عنوان تراکنش را وارد کنید.');
      return;
    }
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      notifyError('مبلغ نامعتبر', 'مبلغ باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (!draft.date) {
      notifyError('فیلد الزامی', 'تاریخ را وارد کنید.');
      return;
    }
    if (!draft.category.trim()) {
      notifyError('فیلد الزامی', 'دسته‌بندی را انتخاب کنید.');
      return;
    }
    update((current) => ({
      ...current,
      transactions: current.transactions.some((transaction) => transaction.id === draft.id)
        ? current.transactions.map((transaction) => (transaction.id === draft.id ? draft : transaction))
        : [...current.transactions, draft],
    }));
    notifySuccess('ذخیره شد', draft.title);
    setDraft(null);
  };

  return (
    <div className="acc-page">
      <SectionHead
        title={title}
        description="ثبت تراکنش‌های نقدی با دسته‌بندی و فیلتر زمانی"
        action={
          <button
            className="btn btn--primary btn--sm"
            onClick={() =>
              setDraft({
                id: uid('txn'),
                kind,
                title: '',
                amount: 0,
                date: todayIso(),
                category: categories[0] ?? 'سایر',
                method: 'cash',
                createdAt: Date.now(),
              })
            }
          >
            <Plus size={14} /> تراکنش جدید
          </button>
        }
      />

      <div className="acc-toolbar">
        <label className="field" style={{ width: 160 }}>
          <span className="field__label">از تاریخ</span>
          <input className="input input--sm" type="date" dir="ltr" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field" style={{ width: 160 }}>
          <span className="field__label">تا تاریخ</span>
          <input className="input input--sm" type="date" dir="ltr" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className="field" style={{ width: 190 }}>
          <span className="field__label">دسته‌بندی</span>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">همه</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <span className="grow" />
        <div className="acc-mini-total">
          <span>جمع {title}</span>
          <Money value={total} />
        </div>
      </div>

      {list.length === 0 ? (
        <AccEmpty title="تراکنشی ثبت نشده" description="با ثبت اولین تراکنش، گزارش‌ها و نمودارها تکمیل می‌شوند." />
      ) : (
        <div className="acc-table-wrap">
          <table className="table acc-table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>عنوان</th>
                <th>دسته‌بندی</th>
                <th>روش پرداخت</th>
                <th>مبلغ</th>
                <th style={{ width: 96 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <DateText date={transaction.date} />
                  </td>
                  <td className="acc-strong">{transaction.title}</td>
                  <td>
                    <span className="badge">{transaction.category}</span>
                  </td>
                  <td className="faint small">
                    {{ cash: 'نقدی', card: 'کارتخوان', transfer: 'انتقال بانکی', cheque: 'چک' }[transaction.method]}
                  </td>
                  <td className={kind === 'income' ? 'acc-income' : 'acc-expense'}>
                    <Money value={transaction.amount} />
                  </td>
                  <td>
                    <span className="row" style={{ gap: 2 }}>
                      <button className="icon-btn" onClick={() => setDraft(transaction)}>
                        <Edit3 size={14} />
                      </button>
                      <button className="icon-btn" onClick={() => setConfirm(transaction)}>
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft && data.transactions.some((transaction) => transaction.id === draft.id) ? 'ویرایش تراکنش' : 'تراکنش جدید'}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={save}>
              ذخیره
            </button>
          </>
        }
      >
        {draft && (
          <div className="col" style={{ gap: 12 }}>
            <label className="field">
              <span className="field__label">عنوان *</span>
              <input className="input" value={draft.title} autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
              <label className="field grow">
                <span className="field__label">مبلغ ({CURRENCY}) *</span>
                <input
                  className="input numeric"
                  type="number"
                  min={1}
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}
                />
              </label>
              <label className="field" style={{ width: 160 }}>
                <span className="field__label">تاریخ *</span>
                <input className="input" type="date" dir="ltr" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </label>
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
              <label className="field grow">
                <span className="field__label">دسته‌بندی *</span>
                <input
                  className="input"
                  list="acc-categories"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
                <datalist id="acc-categories">
                  {categories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="field" style={{ width: 170 }}>
                <span className="field__label">روش پرداخت</span>
                <select
                  className="select"
                  value={draft.method}
                  onChange={(event) => setDraft({ ...draft, method: event.target.value as Transaction['method'] })}
                >
                  <option value="cash">نقدی</option>
                  <option value="card">کارتخوان</option>
                  <option value="transfer">انتقال بانکی</option>
                  <option value="cheque">چک</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field__label">توضیحات</span>
              <textarea
                className="textarea"
                rows={2}
                value={draft.notes ?? ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="حذف تراکنش"
        message={`تراکنش «${confirm?.title ?? ''}» حذف شود؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          update((current) => ({
            ...current,
            transactions: current.transactions.filter((transaction) => transaction.id !== confirm.id),
          }));
          notify('حذف شد', { body: confirm.title, kind: 'info' });
          setConfirm(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export function PaymentsPage({ data, update }: PageProps) {
  const [payment, setPayment] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState(0);

  const openInvoices = data.invoices
    .filter((invoice) => invoiceDue(invoice) > 0)
    .sort((a, b) => invoiceDue(b) - invoiceDue(a));

  const register = () => {
    if (!payment) return;
    if (amount <= 0 || amount > invoiceDue(payment)) {
      notifyError('مبلغ نامعتبر', 'مبلغ باید بین ۱ و مانده فاکتور باشد.');
      return;
    }
    update((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === payment.id
          ? {
              ...invoice,
              paid: invoice.paid + amount,
              status: invoiceStatus({ ...invoice, paid: invoice.paid + amount }),
            }
          : invoice,
      ),
    }));
    notifySuccess('پرداخت ثبت شد', `${payment.number} — ${formatMoney(amount)}`);
    setPayment(null);
  };

  return (
    <div className="acc-page">
      <SectionHead title="پرداخت‌ها" description="ثبت دریافت از مشتریان و پرداخت به تأمین‌کنندگان" />

      <div className="acc-cards">
        <StatCard
          label="مطالبات از مشتریان"
          tone="success"
          value={formatMoney(
            data.invoices.filter((invoice) => invoice.type === 'sale').reduce((sum, invoice) => sum + invoiceDue(invoice), 0),
          )}
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="بدهی به تأمین‌کنندگان"
          tone="danger"
          value={formatMoney(
            data.invoices.filter((invoice) => invoice.type === 'purchase').reduce((sum, invoice) => sum + invoiceDue(invoice), 0),
          )}
          icon={<Banknote size={16} />}
        />
      </div>

      {openInvoices.length === 0 ? (
        <AccEmpty title="همه فاکتورها تسویه شده‌اند" description="فاکتور پرداخت‌نشده‌ای وجود ندارد." />
      ) : (
        <div className="acc-table-wrap">
          <table className="table acc-table">
            <thead>
              <tr>
                <th>شماره</th>
                <th>طرف حساب</th>
                <th>نوع</th>
                <th>جمع کل</th>
                <th>پرداخت‌شده</th>
                <th>مانده</th>
                <th style={{ width: 110 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.map((invoice) => {
                const parties = invoice.type === 'sale' ? data.parties.customers : data.parties.suppliers;
                const party = parties.find((item) => item.id === invoice.partyId);
                return (
                  <tr key={invoice.id}>
                    <td className="mono acc-strong">{invoice.number}</td>
                    <td>{party?.name ?? '—'}</td>
                    <td className="faint small">{invoice.type === 'sale' ? 'فروش' : 'خرید'}</td>
                    <td>
                      <Money value={invoiceTotal(invoice)} />
                    </td>
                    <td>
                      <Money value={invoice.paid} />
                    </td>
                    <td className="acc-due">
                      <Money value={invoiceDue(invoice)} />
                    </td>
                    <td>
                      <button
                        className="btn btn--sm"
                        onClick={() => {
                          setPayment(invoice);
                          setAmount(invoiceDue(invoice));
                        }}
                      >
                        ثبت پرداخت
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(payment)}
        onClose={() => setPayment(null)}
        title={`ثبت پرداخت — ${payment?.number ?? ''}`}
        footer={
          <>
            <button className="btn" onClick={() => setPayment(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={register}>
              ثبت
            </button>
          </>
        }
      >
        {payment && (
          <div className="col" style={{ gap: 12 }}>
            <div className="row-between">
              <span className="muted">مانده</span>
              <strong>{formatMoney(invoiceDue(payment))}</strong>
            </div>
            <label className="field">
              <span className="field__label">مبلغ ({CURRENCY})</span>
              <input className="input numeric" type="number" min={1} value={amount} autoFocus onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bank accounts                                                       */
/* ------------------------------------------------------------------ */

export function BanksPage({ data, update }: PageProps) {
  const [draft, setDraft] = useState<BankAccount | null>(null);
  const [confirm, setConfirm] = useState<BankAccount | null>(null);
  const total = data.banks.reduce((sum, bank) => sum + bank.balance, 0);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.bank.trim()) {
      notifyError('فیلد الزامی', 'نام حساب و نام بانک را وارد کنید.');
      return;
    }
    update((current) => ({
      ...current,
      banks: current.banks.some((bank) => bank.id === draft.id)
        ? current.banks.map((bank) => (bank.id === draft.id ? draft : bank))
        : [...current.banks, draft],
    }));
    notifySuccess('ذخیره شد', draft.name);
    setDraft(null);
  };

  return (
    <div className="acc-page">
      <SectionHead
        title="حساب‌های بانکی"
        description="مدیریت حساب‌ها و موجودی (شبیه‌سازی‌شده)"
        action={
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setDraft({ id: uid('bank'), name: '', bank: '', balance: 0, accountNumber: '' })}
          >
            <Plus size={14} /> حساب جدید
          </button>
        }
      />

      <div className="acc-cards">
        <StatCard label="مجموع موجودی" value={formatMoney(total)} tone="info" icon={<Wallet size={16} />} />
        <StatCard label="تعداد حساب‌ها" value={formatNumber(data.banks.length)} tone="default" />
      </div>

      {data.banks.length === 0 ? (
        <AccEmpty title="حسابی ثبت نشده" description="برای پیگیری موجودی، حساب بانکی اضافه کنید." />
      ) : (
        <div className="acc-bank-grid">
          {data.banks.map((bank) => (
            <div key={bank.id} className="acc-bank">
              <div className="acc-bank__head">
                <strong>{bank.bank}</strong>
                <span className="row" style={{ gap: 2 }}>
                  <button className="icon-btn" onClick={() => setDraft(bank)}>
                    <Edit3 size={13} />
                  </button>
                  <button className="icon-btn" onClick={() => setConfirm(bank)}>
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              <div className="acc-bank__name">{bank.name}</div>
              <div className="acc-bank__number mono" dir="ltr">
                {bank.accountNumber || '—'}
              </div>
              <div className="acc-bank__balance">{formatMoney(bank.balance)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft && data.banks.some((bank) => bank.id === draft.id) ? 'ویرایش حساب' : 'حساب جدید'}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              انصراف
            </button>
            <button className="btn btn--primary" onClick={save}>
              ذخیره
            </button>
          </>
        }
      >
        {draft && (
          <div className="col" style={{ gap: 12 }}>
            <label className="field">
              <span className="field__label">نام حساب *</span>
              <input className="input" value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">بانک *</span>
              <input className="input" value={draft.bank} onChange={(event) => setDraft({ ...draft, bank: event.target.value })} />
            </label>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
              <label className="field grow">
                <span className="field__label">شماره حساب</span>
                <input
                  className="input mono"
                  dir="ltr"
                  value={draft.accountNumber}
                  onChange={(event) => setDraft({ ...draft, accountNumber: event.target.value })}
                />
              </label>
              <label className="field" style={{ width: 190 }}>
                <span className="field__label">موجودی ({CURRENCY})</span>
                <input
                  className="input numeric"
                  type="number"
                  value={draft.balance}
                  onChange={(event) => setDraft({ ...draft, balance: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="حذف حساب"
        message={`حساب «${confirm?.name ?? ''}» حذف شود؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          update((current) => ({ ...current, banks: current.banks.filter((bank) => bank.id !== confirm.id) }));
          notify('حذف شد', { body: confirm.name, kind: 'info' });
          setConfirm(null);
        }}
      />
    </div>
  );
}

export function exportInvoicesCsv(data: AccountingData): string {
  const header = ['شماره', 'نوع', 'تاریخ', 'طرف حساب', 'جمع اقلام', 'مالیات', 'جمع کل', 'پرداخت‌شده', 'مانده', 'وضعیت'];
  const rows = data.invoices.map((invoice) => {
    const parties = invoice.type === 'sale' ? data.parties.customers : data.parties.suppliers;
    const party = parties.find((item) => item.id === invoice.partyId);
    return [
      invoice.number,
      invoice.type === 'sale' ? 'فروش' : 'خرید',
      invoice.date,
      party?.name ?? '',
      invoiceSubtotal(invoice),
      invoiceTax(invoice),
      invoiceTotal(invoice),
      invoice.paid,
      invoiceDue(invoice),
      invoiceStatus(invoice),
    ];
  });
  return ['\uFEFF' + header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function downloadInvoicesCsv(data: AccountingData): void {
  downloadText(`nova-accounting-invoices-${todayIso()}.csv`, exportInvoicesCsv(data), 'text/csv;charset=utf-8');
  notifySuccess('خروجی CSV', `${data.invoices.length} فاکتور`);
}

export const ACCOUNTING_TAB_KEYS = [
  'dashboard',
  'customers',
  'suppliers',
  'products',
  'sales',
  'purchases',
  'income',
  'expenses',
  'payments',
  'banks',
  'reports',
  'settings',
] as const;

export type AccountingTab = (typeof ACCOUNTING_TAB_KEYS)[number];
