import React from 'react';

/** Flips a typed number's sign, keeping the digits ("150" ⇄ "-150") */
export function flipSign(value: string): string {
  const v = value.trim();
  if (/^[-−]/.test(v)) return v.replace(/^[-−]\s*/, '');
  return `-${v.replace(/^\+\s*/, '')}`;
}

/**
 * A number box with a ± button beside it, for odds and lines. Phone number
 * pads have no minus key, so without it nobody could type -110 or -6.5.
 */
export default function SignedInput({
  value,
  onChange,
  className = '',
  id,
  inputMode,
  placeholder,
  autoFocus,
  onKeyDown,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'className'
  | 'id'
  | 'inputMode'
  | 'placeholder'
  | 'autoFocus'
  | 'onKeyDown'
  | 'aria-label'
  | 'aria-invalid'
> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const negative = /^\s*[-−]/.test(value);
  return (
    <span className="flex min-w-0 items-stretch gap-1">
      <button
        type="button"
        onClick={() => onChange(flipSign(value))}
        aria-label={negative ? 'Make it plus' : 'Make it minus'}
        title="Switch + / −"
        className={`w-8 flex-none rounded-md border font-mono text-sm font-bold transition hover:border-emerald-500 ${
          negative
            ? 'border-red-400/60 text-red-300'
            : 'border-emerald-500/60 text-emerald-300'
        }`}
      >
        {negative ? '−' : '+'}
      </button>
      <input
        id={id}
        inputMode={inputMode}
        placeholder={placeholder}
        // Callers focus it only where it's the point of the form
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </span>
  );
}
