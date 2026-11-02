import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) => {
  const { t } = useTranslation();
  return (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </>
    }
  >
    {description && <p className="text-sm text-text-muted">{description}</p>}
  </Modal>
  );
};
