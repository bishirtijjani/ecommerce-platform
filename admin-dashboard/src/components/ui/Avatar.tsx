import { useState } from 'react';
import { cn } from '../../lib/cn';

export const Avatar = ({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) => {
  const [error, setError] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('');

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn('rounded-full object-cover border border-border', className)}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn('flex items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-strong', className)}
      aria-label={name}
      role="img"
    >
      {initials || '?'}
    </div>
  );
};
