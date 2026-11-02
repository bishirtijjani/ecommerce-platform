import { useRef } from 'react';
import { cn } from '../../lib/cn';

export const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (i: number, digit: string) => {
    const chars = value.split('');
    chars[i] = digit;
    const next = chars.join('').slice(0, length);
    onChange(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (text) {
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, length - 1)]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className={cn(
            'h-12 w-11 rounded-md border border-border bg-bg-surface text-center text-lg font-semibold text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
          )}
        />
      ))}
    </div>
  );
};
