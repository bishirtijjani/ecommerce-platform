import { Tags } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Square taxonomy thumbnail with graceful fallbacks: image -> generic tag
 * glyph. Mirrors the admin dashboard so both surfaces read identically.
 */
export const TaxonomyThumb = ({
  imageUrl,
  size = 'md',
  className,
}: {
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn(sizeClass, 'shrink-0 rounded-md border border-border object-cover', className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(sizeClass, 'flex shrink-0 items-center justify-center rounded-md bg-bg-muted text-text-muted', className)}
    >
      <Tags className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  );
};
