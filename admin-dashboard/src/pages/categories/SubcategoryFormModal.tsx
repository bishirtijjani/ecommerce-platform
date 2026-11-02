import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MediaUpload } from '../../components/ui/MediaUpload';
import type { Subcategory } from '../../types';

const isValidImageUrl = (value: string) => !value || /^https?:\/\/\S+$/.test(value);

export const SubcategoryFormModal = ({
  open,
  subcategory,
  categoryName,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  subcategory: Subcategory | null;
  categoryName: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; imageUrl?: string | null; sortOrder?: number }) => void;
  loading?: boolean;
}) => {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(subcategory?.name ?? '');
    setImageUrl(subcategory?.imageUrl ?? '');
    setSortOrder(String(subcategory?.sortOrder ?? 0));
    setError('');
  }, [open, subcategory]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!isValidImageUrl(imageUrl)) {
      setError('Enter a full URL like https://...');
      return;
    }
    onSubmit({
      name: name.trim(),
      imageUrl: imageUrl.trim() || null,
      sortOrder: Number(sortOrder) || 0,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subcategory ? 'Edit subcategory' : 'Add subcategory'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!name.trim()}>
            {subcategory ? 'Save changes' : 'Add subcategory'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="-mt-1 text-sm text-text-muted">Under “{categoryName}”.</p>
        {subcategory?.vendorId && (
          <p className="rounded-md border border-border bg-bg-muted px-3 py-2 text-xs text-text-muted">
            Created by {subcategory.owner?.name ?? 'a vendor'}. Editing moderates this vendor's row.
          </p>
        )}
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          error={error}
          placeholder="e.g. Fresh produce"
        />
        <MediaUpload
          label="Image"
          value={imageUrl || null}
          kind="category"
          aspect="wide"
          onChange={(url) => {
            setImageUrl(url);
            if (error) setError('');
          }}
        />
        <Input label="Sort order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
    </Modal>
  );
};
