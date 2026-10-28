import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils';

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      className="switch"
      data-on={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

interface SliderRowProps {
  label: ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  icon?: LucideIcon;
  className?: string;
}

export function SliderRow({ label, value, min = 0, max = 100, step = 1, onChange, format, icon: Icon, className }: SliderRowProps) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('slider-row', className)}>
      <div className="slider-row__head">
        <span className="slider-row__label">
          {Icon && <Icon size={14} strokeWidth={1.9} />}
          {label}
        </span>
        <span className="slider-row__value numeric">{format ? format(value) : value}</span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={typeof label === 'string' ? label : undefined}
        style={{ ['--slider-progress' as string]: `${progress}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: ReactNode; icon?: LucideIcon; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  full?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', full }: SegmentedProps<T>) {
  return (
    <div className={cn('segmented', size === 'sm' && 'segmented--sm', full && 'segmented--full')} role="tablist">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            title={option.title}
            className={cn('segmented__item', value === option.value && 'is-active')}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon size={14} strokeWidth={2} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('field', className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="empty-state" style={compact ? { minHeight: 120, padding: 20 } : undefined}>
      <div className="empty-state__icon">
        <Icon size={22} strokeWidth={1.7} />
      </div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="small" style={{ maxWidth: 340 }}>{description}</div>}
      {action}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  icon: Icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn('inline-notice', `inline-notice--${tone}`)}>
      {Icon && <Icon size={15} strokeWidth={1.9} className="inline-notice__icon" />}
      <div>{children}</div>
    </div>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-header__title">{title}</h2>
        {description && <p className="section-header__desc">{description}</p>}
      </div>
      {action}
    </div>
  );
}
