import type { ReactNode } from 'react';
import { formatJalali, formatMoney, formatNumber, invoiceStatus } from './accountingStore';
import type { Invoice } from '@/types';
import { cn } from '@/utils';

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('acc-money numeric', className)}>{formatMoney(value)}</span>;
}

export function NumberText({ value }: { value: number }) {
  return <span className="numeric">{formatNumber(value)}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  icon?: ReactNode;
}) {
  return (
    <div className={cn('acc-stat', `acc-stat--${tone}`)}>
      <div className="acc-stat__head">
        <span className="acc-stat__label">{label}</span>
        {icon && <span className="acc-stat__icon">{icon}</span>}
      </div>
      <div className="acc-stat__value">{value}</div>
      {hint && <div className="acc-stat__hint">{hint}</div>}
    </div>
  );
}

export function SectionHead({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="acc-section-head">
      <div>
        <h2 className="acc-section-title">{title}</h2>
        {description && <p className="acc-section-desc">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ invoice }: { invoice: Invoice }) {
  const status = invoiceStatus(invoice);
  const map = {
    paid: { label: 'پرداخت‌شده', className: 'badge--accent' },
    partial: { label: 'پرداخت جزئی', className: 'badge--warning' },
    unpaid: { label: 'پرداخت‌نشده', className: '' },
  } as const;
  return <span className={cn('badge', map[status].className)}>{map[status].label}</span>;
}

export function DateText({ date }: { date: string }) {
  return <span className="acc-date">{formatJalali(date)}</span>;
}

export function MonthlyChart({ series }: { series: Array<{ label: string; sales: number; expenses: number }> }) {
  const max = Math.max(1, ...series.flatMap((item) => [item.sales, item.expenses]));
  return (
    <div className="acc-chart">
      <div className="acc-chart__legend">
        <span className="row" style={{ gap: 6 }}>
          <i className="acc-dot" style={{ background: 'var(--accent)' }} /> فروش و درآمد
        </span>
        <span className="row" style={{ gap: 6 }}>
          <i className="acc-dot" style={{ background: '#ff7a90' }} /> هزینه‌ها
        </span>
      </div>
      <div className="acc-chart__plot">
        {series.map((item) => (
          <div key={item.label} className="acc-chart__group">
            <div className="acc-chart__bars">
              <div
                className="acc-chart__bar acc-chart__bar--sales"
                style={{ height: `${Math.max(2, (item.sales / max) * 100)}%` }}
                title={formatMoney(item.sales)}
              />
              <div
                className="acc-chart__bar acc-chart__bar--expenses"
                style={{ height: `${Math.max(2, (item.expenses / max) * 100)}%` }}
                title={formatMoney(item.expenses)}
              />
            </div>
            <span className="acc-chart__label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="acc-empty">
      <div className="acc-empty__title">{title}</div>
      {description && <div className="acc-empty__desc">{description}</div>}
      {action}
    </div>
  );
}
