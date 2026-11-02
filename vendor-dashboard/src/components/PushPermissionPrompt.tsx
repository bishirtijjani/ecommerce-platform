import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { subscribePromptHost, requestPermissionNow } from '../services/push';

type Payload = { title: string; message: string; resolve: (ok: boolean) => void };

/** Renders the themed "why we need notifications" soft-ask. Mount once. */
export const PushPermissionPrompt = () => {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => subscribePromptHost(setPayload), []);

  if (!payload) return null;

  const close = (ok: boolean) => {
    const p = payload;
    setPayload(null);
    p.resolve(ok);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-bg-surface p-6 shadow-popover animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-bg-muted text-brand">
          <Bell className="h-5 w-5" />
        </div>
        <h2 className="text-base font-bold text-text-primary">{payload.title}</h2>
        <p className="mt-2 text-sm leading-5 text-text-muted">{payload.message}</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-muted hover:bg-bg-muted"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              requestPermissionNow();
              close(true);
            }}
            className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
};
