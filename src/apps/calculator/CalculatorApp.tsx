import { useEffect, useState } from 'react';
import { Delete, Divide, Equal, Minus, Percent, Plus, X } from 'lucide-react';
import type { AppWindowProps } from '@/core/apps/types';
import { useT } from '@/core/localization/i18n';
import { evaluateExpression } from '@/utils/expression';
import { cn } from '@/utils';

const KEYS = [
  ['C', '(', ')', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '%', '='],
];

const KEY_LABELS: Record<string, string> = {
  '*': 'Multiply',
  '/': 'Divide',
  '+': 'Plus',
  '-': 'Minus',
  '=': 'Equals',
  '.': 'Decimal point',
  '%': 'Percent',
  '(': 'Open parenthesis',
  ')': 'Close parenthesis',
};

export function CalculatorApp(_props: AppWindowProps) {
  const t = useT();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const evaluate = () => {
    if (!expression.trim()) return;
    try {
      const value = evaluateExpression(expression);
      const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));
      setResult(formatted);
      setError(null);
      setHistory((current) => [`${expression} = ${formatted}`, ...current].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid expression');
      setResult('');
    }
  };

  const press = (key: string) => {
    setError(null);
    if (key === 'C') {
      setExpression('');
      setResult('');
      return;
    }
    if (key === '=') {
      evaluate();
      return;
    }
    if (key === '%') {
      // Treat percent as "divide the last number by 100".
      const match = /(\d+\.?\d*)$/.exec(expression);
      if (match) {
        setExpression(`${expression.slice(0, match.index)}(${match[1]}/100)`);
      } else {
        setExpression(`${expression}%`);
      }
      return;
    }
    if (key === '±') {
      setExpression((current) => (current.startsWith('-') ? current.slice(1) : `-${current}`));
      return;
    }
    setExpression((current) => `${current}${key}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (/^[0-9.+\-*/()%]$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        evaluate();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setExpression((current) => current.slice(0, -1));
      } else if (event.key === 'Escape') {
        press('C');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression]);

  const iconFor = (key: string) => {
    switch (key) {
      case '/':
        return <Divide size={18} />;
      case '*':
        return <X size={18} />;
      case '-':
        return <Minus size={18} />;
      case '+':
        return <Plus size={18} />;
      case '=':
        return <Equal size={18} />;
      case '%':
        return <Percent size={18} />;
      default:
        return key;
    }
  };

  return (
    <div className="app calculator">
      <div className="calculator__display">
        <div className="calculator__expression">{expression || '0'}</div>
        <div className={cn('calculator__result', error && 'is-error')}>
          {error ? error : result || '\u00A0'}
        </div>
      </div>
      <div className="calculator__keys">
        <button className="calc-key calc-key--action" onClick={() => press('C')} aria-label={t('Clear')}>
          {t('Clear')}
        </button>
        <button className="calc-key" onClick={() => press('(')} aria-label={t('Open parenthesis')}>
          (
        </button>
        <button className="calc-key" onClick={() => press(')')} aria-label={t('Close parenthesis')}>
          )
        </button>
        <button className="calc-key calc-key--op" onClick={() => press('/')} aria-label={t('Divide')}>
          {iconFor('/')}
        </button>
        {KEYS.slice(1).flat().map((key) => (
          <button
            key={key}
            className={cn(
              'calc-key',
              ['+', '-', '*'].includes(key) && 'calc-key--op',
              key === '=' && 'calc-key--equals',
            )}
            onClick={() => press(key)}
            aria-label={KEY_LABELS[key] ? t(KEY_LABELS[key]) : key}
            title={KEY_LABELS[key] ? t(KEY_LABELS[key]) : key}
          >
            {iconFor(key)}
          </button>
        ))}
        <button
          className="calc-key calc-key--action"
          onClick={() => setExpression((current) => current.slice(0, -1))}
          title={t('Backspace')}
          aria-label={t('Backspace')}
        >
          <Delete size={17} />
        </button>
      </div>
      {history.length > 0 && (
        <div className="calculator__history">
          <div className="tiny faint" style={{ marginBottom: 4 }}>
            {t('History')}
          </div>
          {history.map((entry) => (
            <div key={entry} className="calculator__history-row mono">
              {entry}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
