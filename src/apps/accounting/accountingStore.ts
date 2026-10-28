import type {
  AccountingData,
  AccountingParty,
  AccountingProduct,
  BankAccount,
  Invoice,
  InvoiceLine,
  Transaction,
} from '@/types';
import { PersistedValue } from '@/core/persistence/kvStore';
import { nextInvoiceNumber, uid } from '@/utils';

export const CURRENCY = 'تومان';

export function emptyAccounting(): AccountingData {
  return {
    parties: { customers: [], suppliers: [] },
    products: [],
    invoices: [],
    transactions: [],
    banks: [],
    settings: { businessName: 'کسب‌وکار من', taxRate: 9, currency: 'IRT', sampleData: false, language: 'fa' },
  };
}

function iso(offsetMonths: number, day: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + offsetMonths);
  date.setDate(Math.min(day, 28));
  return date.toISOString().slice(0, 10);
}

function line(description: string, qty: number, price: number, discount = 0): InvoiceLine {
  return { id: uid('line'), description, qty, price, discount };
}

export function sampleAccounting(): AccountingData {
  const customers: AccountingParty[] = [
    { id: 'c1', name: 'شرکت آفتاب نوین', phone: '021-88776655', notes: 'مشتری عمده', createdAt: Date.now() },
    { id: 'c2', name: 'فروشگاه گلستان', phone: '0912-3456789', createdAt: Date.now() },
    { id: 'c3', name: 'آقای رضایی', phone: '0935-1122334', createdAt: Date.now() },
    { id: 'c4', name: 'کافه نقطه', phone: '021-44556677', createdAt: Date.now() },
  ];
  const suppliers: AccountingParty[] = [
    { id: 's1', name: 'تأمین‌کننده پارس', phone: '021-22334455', createdAt: Date.now() },
    { id: 's2', name: 'کاغذ و مقوا ایرانیان', phone: '021-99887766', createdAt: Date.now() },
  ];
  const products: AccountingProduct[] = [
    { id: 'p1', name: 'خدمات مشاوره', price: 4_500_000, unit: 'ساعت', taxRate: 9 },
    { id: 'p2', name: 'طراحی وب‌سایت', price: 28_000_000, unit: 'پروژه', taxRate: 9 },
    { id: 'p3', name: 'پشتیبانی ماهانه', price: 6_500_000, unit: 'ماه', taxRate: 9 },
    { id: 'p4', name: 'چاپ کارت ویزیت', price: 1_200_000, unit: 'بسته', taxRate: 9 },
    { id: 'p5', name: 'کاغذ A4', price: 850_000, unit: 'بسته', taxRate: 9 },
  ];
  const invoices: Invoice[] = [
    {
      id: 'inv1',
      number: 'INV-1001',
      type: 'sale',
      partyId: 'c1',
      date: iso(-2, 8),
      lines: [line('طراحی وب‌سایت', 1, 28_000_000), line('پشتیبانی ماهانه', 2, 6_500_000)],
      taxRate: 9,
      status: 'paid',
      paid: 44_685_000,
      createdAt: Date.now(),
      notes: 'پروژه وب‌سایت شرکتی',
    },
    {
      id: 'inv2',
      number: 'INV-1002',
      type: 'sale',
      partyId: 'c2',
      date: iso(-1, 12),
      lines: [line('خدمات مشاوره', 6, 4_500_000, 1_500_000)],
      taxRate: 9,
      status: 'partial',
      paid: 10_000_000,
      createdAt: Date.now(),
    },
    {
      id: 'inv3',
      number: 'INV-1003',
      type: 'sale',
      partyId: 'c3',
      date: iso(0, 4),
      lines: [line('چاپ کارت ویزیت', 3, 1_200_000)],
      taxRate: 9,
      status: 'unpaid',
      paid: 0,
      createdAt: Date.now(),
    },
    {
      id: 'inv4',
      number: 'INV-1004',
      type: 'sale',
      partyId: 'c4',
      date: iso(0, 15),
      lines: [line('پشتیبانی ماهانه', 1, 6_500_000)],
      taxRate: 9,
      status: 'paid',
      paid: 7_085_000,
      createdAt: Date.now(),
    },
    {
      id: 'pur1',
      number: 'PUR-1001',
      type: 'purchase',
      partyId: 's1',
      date: iso(-1, 5),
      lines: [line('کاغذ A4', 20, 850_000)],
      taxRate: 9,
      status: 'paid',
      paid: 18_530_000,
      createdAt: Date.now(),
    },
    {
      id: 'pur2',
      number: 'PUR-1002',
      type: 'purchase',
      partyId: 's2',
      date: iso(0, 9),
      lines: [line('چاپ کارت ویزیت', 5, 1_200_000)],
      taxRate: 9,
      status: 'unpaid',
      paid: 0,
      createdAt: Date.now(),
    },
  ];
  const transactions: Transaction[] = [
    { id: 't1', kind: 'expense', title: 'اجاره دفتر', amount: 18_000_000, date: iso(-2, 2), category: 'اجاره', method: 'transfer', createdAt: Date.now() },
    { id: 't2', kind: 'expense', title: 'اینترنت و تلفن', amount: 1_450_000, date: iso(-1, 6), category: 'آب و برق و ارتباطات', method: 'card', createdAt: Date.now() },
    { id: 't3', kind: 'income', title: 'درآمد پروژه جانبی', amount: 12_000_000, date: iso(-1, 18), category: 'فروش', method: 'transfer', createdAt: Date.now() },
    { id: 't4', kind: 'expense', title: 'حقوق همکار', amount: 26_000_000, date: iso(0, 3), category: 'حقوق', method: 'transfer', createdAt: Date.now() },
    { id: 't5', kind: 'income', title: 'دریافت از مشتری', amount: 10_000_000, date: iso(0, 12), category: 'دریافت', method: 'cash', partyId: 'c2', createdAt: Date.now() },
    { id: 't6', kind: 'expense', title: 'تبلیغات اینستاگرام', amount: 3_200_000, date: iso(0, 20), category: 'بازاریابی', method: 'card', createdAt: Date.now() },
  ];
  const banks: BankAccount[] = [
    { id: 'b1', name: 'حساب جاری', bank: 'بانک ملت', balance: 84_500_000, accountNumber: '6104-3378-1122' },
    { id: 'b2', name: 'حساب پس‌انداز', bank: 'بانک سامان', balance: 32_000_000, accountNumber: '8801-5522-9001' },
  ];
  return {
    parties: { customers, suppliers },
    products,
    invoices,
    transactions,
    banks,
    settings: { businessName: 'استودیو نوآ', taxRate: 9, currency: 'IRT', sampleData: true, language: 'fa' },
  };
}

export const accountingStore = new PersistedValue<AccountingData>('app.accounting.v1', sampleAccounting());

export function resetToSample(): void {
  accountingStore.set(sampleAccounting());
}

export function clearAccounting(): void {
  accountingStore.set(emptyAccounting());
}

/* ------------------------------------------------------------------ */
/* Calculations                                                        */
/* ------------------------------------------------------------------ */

export function lineTotal(item: InvoiceLine): number {
  return Math.max(0, item.qty * item.price - item.discount);
}

export function invoiceSubtotal(invoice: Invoice): number {
  return invoice.lines.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function invoiceTax(invoice: Invoice): number {
  return Math.round((invoiceSubtotal(invoice) * invoice.taxRate) / 100);
}

export function invoiceTotal(invoice: Invoice): number {
  return invoiceSubtotal(invoice) + invoiceTax(invoice);
}

export function invoiceDue(invoice: Invoice): number {
  return Math.max(0, invoiceTotal(invoice) - invoice.paid);
}

export function invoiceStatus(invoice: Invoice): Invoice['status'] {
  const total = invoiceTotal(invoice);
  if (invoice.paid <= 0) return 'unpaid';
  if (invoice.paid >= total) return 'paid';
  return 'partial';
}

export function nextNumber(data: AccountingData, type: 'sale' | 'purchase'): string {
  return nextInvoiceNumber(
    data.invoices.filter((invoice) => invoice.type === type).map((invoice) => invoice.number),
    type,
  );
}

export function totals(data: AccountingData) {
  const sales = data.invoices.filter((invoice) => invoice.type === 'sale');
  const purchases = data.invoices.filter((invoice) => invoice.type === 'purchase');
  const salesTotal = sales.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const purchaseTotal = purchases.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const transactionIncome = data.transactions.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const transactionExpense = data.transactions.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const received = sales.reduce((sum, invoice) => sum + invoice.paid, 0) + transactionIncome;
  const paid = purchases.reduce((sum, invoice) => sum + invoice.paid, 0) + transactionExpense;
  const receivables = sales.reduce((sum, invoice) => sum + invoiceDue(invoice), 0);
  const payables = purchases.reduce((sum, invoice) => sum + invoiceDue(invoice), 0);
  return {
    salesTotal,
    purchaseTotal,
    transactionIncome,
    transactionExpense,
    received,
    paid,
    receivables,
    payables,
    expensesTotal: transactionExpense + purchaseTotal,
    balance: received - paid,
  };
}

export function monthlySeries(data: AccountingData, months = 6) {
  const labels: Array<{ key: string; label: string; sales: number; expenses: number }> = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    labels.push({
      key,
      label: new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(date),
      sales: 0,
      expenses: 0,
    });
  }
  const bucket = (date: string) => labels.find((item) => date.startsWith(item.key));
  data.invoices.forEach((invoice) => {
    const entry = bucket(invoice.date);
    if (!entry) return;
    if (invoice.type === 'sale') entry.sales += invoiceTotal(invoice);
    else entry.expenses += invoiceTotal(invoice);
  });
  data.transactions.forEach((transaction) => {
    const entry = bucket(transaction.date);
    if (!entry) return;
    if (transaction.kind === 'income') entry.sales += transaction.amount;
    else entry.expenses += transaction.amount;
  });
  return labels;
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(value))} ${CURRENCY}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatJalali(date: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function categoriesOf(data: AccountingData, kind: 'income' | 'expense'): string[] {
  const defaults =
    kind === 'expense'
      ? ['اجاره', 'حقوق', 'آب و برق و ارتباطات', 'بازاریابی', 'حمل و نقل', 'خرید کالا', 'سایر']
      : ['فروش', 'دریافت', 'خدمات', 'سرمایه', 'سایر'];
  const used = data.transactions.filter((item) => item.kind === kind).map((item) => item.category);
  return Array.from(new Set([...used, ...defaults]));
}
