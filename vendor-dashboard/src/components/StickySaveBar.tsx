import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

interface StickySaveBarProps {
  dirty: boolean;
  saving?: boolean;
  saveLabel?: string;
  onSave: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * A fixed save bar pinned to the bottom of the viewport so the Save action is
 * always visible even on long forms that scroll. On mobile it floats just above
 * the BottomNav; on desktop it sits at the very bottom. It only renders once
 * there are unsaved changes, so a pristine form stays unobtrusive.
 */
export const StickySaveBar = ({ dirty, saving = false, saveLabel, onSave, onCancel, cancelLabel }: StickySaveBarProps) => {
  const { t } = useTranslation();
  if (!dirty) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-50 flex items-center justify-end gap-3',
        'border-t border-border bg-bg-surface/95 px-4 py-3 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.06)]',
        'pb-[calc(env(safe-area-inset-bottom)+12px)]',
        'bottom-[68px] lg:bottom-0',
        'animate-slide-up',
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-3">
        <span className="mr-auto text-xs font-medium text-text-muted">
          {t('common.unsavedChanges')}
        </span>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
        )}
        <Button onClick={onSave} loading={saving}>
          {saveLabel ?? t('common.saveChanges')}
        </Button>
      </div>
    </div>
  );
};
