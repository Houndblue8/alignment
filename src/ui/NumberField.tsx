import { useEffect, useState, type InputHTMLAttributes } from 'react';

/**
 * A number box you can simply type into: it can be empty while typing (no stuck leading 0), opens the
 * number pad on phones, and selects its contents on focus so the first digit replaces the old value.
 */
export function NumberField({
  value,
  onValue,
  ...rest
}: { value: number; onValue: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((cur) => (Number(cur) === value && cur !== '' ? cur : String(value)));
  }, [value]);
  return (
    <input
      {...rest}
      className={rest.className ?? 'field'}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onFocus={(e) => {
        e.currentTarget.select();
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
        setText(digits);
        if (digits !== '') onValue(Number(digits));
      }}
      onBlur={(e) => {
        if (text === '') setText(String(value));
        rest.onBlur?.(e);
      }}
    />
  );
}
