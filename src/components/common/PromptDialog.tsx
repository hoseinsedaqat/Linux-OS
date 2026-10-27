import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { useT } from '@/core/localization/i18n';

interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel,
  validate,
  onCancel,
  onSubmit,
}: PromptDialogProps) {
  const t = useT();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    const validation = validate ? validate(trimmed) : trimmed ? null : t('Name cannot be empty');
    if (validation) {
      setError(validation);
      return;
    }
    onSubmit(trimmed);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            {t('Cancel')}
          </button>
          <button className="btn btn--primary" onClick={submit}>
            {confirmLabel ?? t('OK')}
          </button>
        </>
      }
    >
      <label className="field">
        {label && <span className="field__label">{label}</span>}
        <input
          className={`input ${error ? 'input--error' : ''}`}
          value={value}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
        {error && <span className="field__error">{error}</span>}
      </label>
    </Modal>
  );
}
