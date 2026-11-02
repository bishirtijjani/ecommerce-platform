import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { useCategories } from '../../hooks/useCategories';
import type { ProductCreateInput } from '../../api/products';
import type { Product, ProductCondition } from '../../types';

export type ProductFormValues = ProductCreateInput;

interface FormState {
  name: string;
  description: string;
  basePrice: string;
  stock: string;
  categoryId: string;
  subcategoryId: string;
  images: string[];
  videoUrl: string;
  isAvailable: boolean;
  condition: ProductCondition;
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  basePrice: '',
  stock: '0',
  categoryId: '',
  subcategoryId: '',
  images: [],
  videoUrl: '',
  isAvailable: true,
  condition: 'NEW',
});

const fromProduct = (product: Product): FormState => ({
  name: product.name,
  description: product.description ?? '',
  basePrice: String(product.basePrice),
  stock: String(product.stock ?? 0),
  categoryId: product.categoryId,
  subcategoryId: product.subcategoryId ?? '',
  images: product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [],
  videoUrl: product.videoUrl ?? '',
  isAvailable: product.isAvailable,
  condition: product.condition ?? 'NEW',
});

export const ProductFormModal = ({
  open,
  product,
  vendorId,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  product: Product | null;
  vendorId: string;
  onClose: () => void;
  onSubmit: (data: ProductFormValues) => void;
  loading?: boolean;
}) => {
  const { data: categoriesData } = useCategories({ limit: 200 });
  const categories = useMemo(
    () => (categoriesData?.data ?? []).filter((c) => !c.vendorId || c.vendorId === vendorId),
    [categoriesData, vendorId],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');

  // Re-seed only when the modal opens/closes or switches product, not on
  // background list refetches (which hand us a new object with the same id).
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const key = open ? (product?.id ?? 'new') : null;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (!open) {
      setForm(null);
      return;
    }
    setForm(product ? fromProduct(product) : emptyForm());
    setError('');
  }, [open, product]);

  const subcategories = useMemo(
    () =>
      (categories.find((c) => c.id === form?.categoryId)?.subcategories ?? []).filter(
        (s) => !s.vendorId || s.vendorId === vendorId,
      ),
    [categories, form?.categoryId, vendorId],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSubmit = () => {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) return setError('Product name must be at least 2 characters');
    const basePrice = Number(form.basePrice);
    if (!Number.isFinite(basePrice) || basePrice < 0) return setError('Enter a valid price');
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) return setError('Enter a valid stock quantity');
    if (!form.categoryId) return setError('Select a category');

    onSubmit({
      name,
      description: form.description.trim() || undefined,
      basePrice,
      stock,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || null,
      images: form.images,
      imageUrl: form.images[0] || undefined,
      videoUrl: form.videoUrl || undefined,
      isAvailable: form.isAvailable,
      condition: form.condition,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.name}` : 'Add product'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!form}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      {form && (
        <div className="space-y-4">
          <Input label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Price (₦)"
              type="number"
              min={0}
              value={form.basePrice}
              onChange={(e) => set('basePrice', e.target.value)}
            />
            <Input
              label="Stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
            />
          </div>
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => set('condition', e.target.value as ProductCondition)}
          >
            <option value="NEW">New</option>
            <option value="USED">Used</option>
            <option value="SECOND_HAND">Second Hand</option>
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              required
              value={form.categoryId}
              onChange={(e) => {
                set('categoryId', e.target.value);
                set('subcategoryId', '');
              }}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Subcategory"
              value={form.subcategoryId}
              disabled={!form.categoryId}
              onChange={(e) => set('subcategoryId', e.target.value)}
            >
              <option value="">No subcategory</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-text-primary">
              Images <span className="font-normal text-text-muted">(first is the cover, up to 5)</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <img src={url} alt="" className="h-24 w-24 rounded-md border border-border object-cover" />
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => set('images', form.images.filter((_, i) => i !== index))}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white shadow"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {form.images.length < 5 && (
                <MediaUpload
                  value={null}
                  multiple
                  maxCount={5 - form.images.length}
                  kind="product"
                  aspect="square"
                  containerClassName="h-24 w-24"
                  onChangeMany={(results) => {
                    const urls = results.filter((r) => r.type === 'image').map((r) => r.url);
                    set('images', [...form.images, ...urls].slice(0, 5));
                  }}
                />
              )}
            </div>
          </div>

          <MediaUpload
            label="Product video"
            value={form.videoUrl || null}
            mediaType="video"
            acceptVideo
            kind="product"
            aspect="wide"
            onChange={(url) => set('videoUrl', url)}
          />

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Available</p>
              <p className="text-xs text-text-muted">
                {form.isAvailable ? 'Visible and buyable by customers.' : 'Hidden from the customer catalogue.'}
              </p>
            </div>
            <Switch
              checked={form.isAvailable}
              onChange={(checked) => set('isAvailable', checked)}
              ariaLabel="Toggle product availability"
            />
          </div>
          {error && <p className="text-sm text-error-strong">{error}</p>}
        </div>
      )}
    </Modal>
  );
};
