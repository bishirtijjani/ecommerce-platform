import { cn } from '../../lib/cn';

export const Switch = ({
  checked,
  onChange,
  disabled,
  label,
  ariaLabel,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  id?: string;
}) => {
  const switchId = id || (label ? `switch-${Math.random().toString(36).slice(2, 9)}` : undefined);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel || 'Toggle'}
        aria-labelledby={label && switchId ? `${switchId}-label` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas',
          checked ? 'bg-brand' : 'bg-bg-strong',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-150',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
      {label && (
        <label id={`${switchId}-label`} htmlFor={switchId} className="text-sm text-text-primary">
          {label}
        </label>
      )}
    </div>
  );
};
