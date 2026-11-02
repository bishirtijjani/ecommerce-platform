import type { ReactNode } from 'react';
import { Logo } from '../../components/ui/Logo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export const AuthLayout = ({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-canvas px-4 py-12">
    <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-soft blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-soft blur-3xl" />
    <div className={`relative w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
      <div className="mb-6 flex justify-center">
        <LanguageSwitcher />
      </div>
      <div className="mb-8 flex justify-center">
        <Logo size={30} />
      </div>
      <div className="rounded-lg border border-border bg-bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  </div>
);
