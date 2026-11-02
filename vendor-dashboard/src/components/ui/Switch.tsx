import { cn } from '../../lib/cn';

export const Switch = ({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas',
      checked ? 'bg-brand' : 'bg-bg-strong',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
    aria-label={label}
  >
    <span
      className={cn(
        'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-150',
        checked ? 'translate-x-6' : 'translate-x-1',
      )}
      style={{ height: 18, width: 18 }}
    />
  </button>
);
