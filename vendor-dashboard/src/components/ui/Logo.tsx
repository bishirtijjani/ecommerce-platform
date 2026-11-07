import { cn } from '../../lib/cn';
import logoUrl from '../../assets/logo.png';

/**
 * Marketplace's brand mark (brand/logo.png) — a transparent PNG, so it inherits
 * whatever surface it sits on. Rendered at `size` px, keep-alive across the
 * dashboard (sidebar, topbar, auth, onboarding, 404).
 */
export const LogoMark = ({ size = 32, className }: { size?: number; className?: string }) => (
  <img
    src={logoUrl}
    width={size}
    height={size}
    alt="Marketplace"
    className={cn('shrink-0 object-contain', className)}
  />
);

export const Logo = ({ size = 32, wordmark = true, className }: { size?: number; wordmark?: boolean; className?: string }) => (
  <div className={cn('flex items-center gap-2.5', className)}>
    <LogoMark size={size} />
    {wordmark && (
      <span style={{ fontSize: size * 0.5 }} className="font-bold tracking-tight text-text-primary">
        Marketplace
        <span className="ml-1.5 align-middle text-[0.6em] font-semibold uppercase tracking-wide text-text-muted">Vendor</span>
      </span>
    )}
  </div>
);
