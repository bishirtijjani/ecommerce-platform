import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { ColorField } from '../../components/ui/ColorField';
import { EmojiField } from '../../components/ui/EmojiField';
import type { CategoryInput } from '../../api/categories';
import { isValidHex } from '../../lib/validation';
import type { VendorCategory } from '../../types';

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  imageUrl: string;
  sortOrder: string;
  hasPreparation: boolean;
}

const emptyForm: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  color: '',
  imageUrl: '',
  sortOrder: '0',
  hasPreparation: true,
};

const isValidImageUrl = (value: string) => !value || /^https?:\/\/\S+$/.test(value);

const validate = (form: CategoryFormData) => {
  const errors: { name?: string; color?: string; icon?: string; imageUrl?: string } = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (form.color && !isValidHex(form.color)) errors.color = 'Enter a valid hex color like #0B3D24';
  if (form.icon && form.icon.length > 10) errors.icon = 'Icon must be a single emoji or short symbol';
  if (!isValidImageUrl(form.imageUrl)) errors.imageUrl = 'Enter a full URL like https://...';
  return errors;
};

export const CategoryFormModal = ({
  open,
  category,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  category: VendorCategory | null;
  onClose: () => void;
  onSubmit: (payload: CategoryInput) => void;
  loading?: boolean;
}) => {
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon || '',
        color: category.color || '',
        imageUrl: category.imageUrl || '',
        sortOrder: String(category.sortOrder || 0),
        hasPreparation: category.hasPreparation ?? true,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, category]);

  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const updateField = (field: keyof CategoryFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched(true);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (Object.keys(validate(form)).length > 0) return;
    onSubmit({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      icon: form.icon.trim() || undefined,
      color: form.color.trim() || undefined,
      imageUrl: form.imageUrl.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      hasPreparation: form.hasPreparation,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'Add category'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={hasErrors}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          error={touched ? errors.name : undefined}
          placeholder="e.g. Fresh produce"
        />
        <Input
          label="Slug"
          hint="Leave blank to auto-generate."
          value={form.slug}
          onChange={(e) => updateField('slug', e.target.value)}
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
        <div>
          <MediaUpload
            label="Cover image"
            value={form.imageUrl || null}
            kind="category"
            aspect="wide"
            onChange={(url) => updateField('imageUrl', url)}
          />
          {touched && errors.imageUrl && <p className="mt-1.5 text-xs text-error-strong">{errors.imageUrl}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmojiField
            label="Icon"
            value={form.icon}
            onChange={(value) => updateField('icon', value)}
            placeholder="🛒"
            error={touched ? errors.icon : undefined}
          />
          <ColorField
            label="Accent color"
            value={form.color}
            onChange={(value) => updateField('color', value)}
            error={touched ? errors.color : undefined}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            hint="Lower shows first. Prefer drag/move in the list."
          />
          <div className="flex items-end pb-1">
            <Switch
              label="Has preparation options"
              checked={form.hasPreparation}
              onChange={(checked) => setForm((prev) => ({ ...prev, hasPreparation: checked }))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
