import { useState } from 'react';
import { FolderTree, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  useProducts,
  useToggleProductAvailability,
  useDeleteProduct,
  useCreateProduct,
  useUpdateProduct,
} from '../../hooks/useProducts';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Badge, ProductConditionBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Switch } from '../../components/ui/Switch';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatNaira } from '../../lib/format';
import type { Product, ProductCondition } from '../../types';
import { ProductFormModal, type ProductFormValues } from './ProductEditModal';

const AVAILABILITY_OPTIONS: { value: '' | 'available' | 'unavailable'; label: string }[] = [
  { value: '', label: 'All availability' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
];

const CONDITION_OPTIONS: { value: '' | ProductCondition; label: string }[] = [
  { value: '', label: 'All conditions' },
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'SECOND_HAND', label: 'Second Hand' },
];

const categoryLabel = (product: Product): string => {
  const parts: string[] = [];
  if (product.category?.name) parts.push(product.category.name);
  if (product.subcategory?.name) parts.push(product.subcategory.name);
  return parts.join(' · ') || '-';
};

const AvailabilityBadge = ({ available }: { available: boolean }) => (
  <Badge tone={available ? 'success' : 'neutral'}>{available ? 'Available' : 'Unavailable'}</Badge>
);

const ProductThumb = ({ product, size = 'md' }: { product: Product; size?: 'md' | 'lg' }) => {
  const src = product.imageUrl || product.images[0];
  const cls = size === 'lg' ? 'h-24 w-24' : 'h-10 w-10';
  if (src) return <img src={src} alt={product.name} className={`${cls} shrink-0 rounded-md border border-border object-cover`} />;
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-md border border-border bg-bg-muted text-text-muted`}>
      <FolderTree className={size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'} />
    </div>
  );
};

const ProductDetailModal = ({
  product,
  onClose,
  onToggle,
  onDelete,
  onEdit,
  togglePending,
}: {
  product: Product | null;
  onClose: () => void;
  onToggle: (product: Product) => void;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  togglePending: boolean;
}) => (
  <Modal
    open={!!product}
    onClose={onClose}
    title={product?.name}
    size="lg"
    footer={
      <>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {product && (
          <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(product)}>
            Edit
          </Button>
        )}
        {product && (
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(product)}>
            Delete
          </Button>
        )}
      </>
    }
  >
    {product && (
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <ProductThumb product={product} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-semibold text-text-primary">{product.name}</p>
            <p className="text-sm text-text-muted">{categoryLabel(product)}</p>
            <div className="flex items-center gap-2 pt-1">
              <AvailabilityBadge available={product.isAvailable} />
              <ProductConditionBadge condition={product.condition} />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-muted/40 p-4 sm:grid-cols-4">
          {[
            { label: 'Price', value: formatNaira(product.basePrice) },
            { label: 'Stock', value: String(product.stock ?? '-') },
            { label: 'Orders', value: String(product.orderCount ?? '-') },
            { label: 'Listed', value: formatDate(product.createdAt) },
          ].map((fact) => (
            <div key={fact.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{fact.label}</dt>
              <dd className="text-sm font-medium text-text-primary">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {product.description && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Description</p>
            <p className="whitespace-pre-wrap text-sm text-text-primary">{product.description}</p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Media</p>
          {product.images.length || product.imageUrl || product.videoUrl ? (
            <div className="space-y-3">
              {(product.images.length ? product.images : product.imageUrl ? [product.imageUrl] : []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(product.images.length ? product.images : [product.imageUrl as string]).map((url, i) => (
                    <img
                      key={`${url}-${i}`}
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-md border border-border object-cover"
                    />
                  ))}
                </div>
              )}
              {product.videoUrl && (
                <video src={product.videoUrl} controls className="w-full max-w-sm rounded-md border border-border" />
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No images or video uploaded for this product.</p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Availability</p>
            <p className="text-xs text-text-muted">
              {product.isAvailable ? 'Visible to customers and buyable.' : 'Hidden from the customer catalogue.'}
            </p>
          </div>
          <Switch
            checked={product.isAvailable}
            onChange={() => onToggle(product)}
            disabled={togglePending}
            ariaLabel={`Mark ${product.isAvailable ? 'unavailable' : 'available'}: ${product.name}`}
          />
        </div>
      </div>
    )}
  </Modal>
);

export const VendorProducts = ({ vendorId }: { vendorId: string }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [availability, setAvailability] = useState<'' | 'available' | 'unavailable'>('');
  const [condition, setCondition] = useState<'' | ProductCondition>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useProducts({
    page,
    limit,
    vendorId,
    search: debouncedSearch || undefined,
    isAvailable: availability === 'available' ? true : availability === 'unavailable' ? false : undefined,
    condition: condition || undefined,
  });

  const toggle = useToggleProductAvailability();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Derive the open product from live query data so availability toggles and
  // refetches are reflected in the modal, and it auto-closes if it disappears.
  const viewingProduct = viewingId ? data?.data.find((p) => p.id === viewingId) ?? null : null;
  const editingProduct = editingId ? data?.data.find((p) => p.id === editingId) ?? null : null;

  const handleToggle = (product: Product) => {
    toggle.mutate({ vendorId: product.vendorId, productId: product.id, isAvailable: !product.isAvailable });
  };

  const handleEditSave = (data: ProductFormValues) => {
    if (!editingProduct) return;
    updateProduct.mutate(
      { vendorId: editingProduct.vendorId, productId: editingProduct.id, data },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleCreate = (data: ProductFormValues) => {
    createProduct.mutate({ vendorId, data }, { onSuccess: () => setCreating(false) });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProduct.mutate(
      { vendorId: deleteTarget.vendorId, productId: deleteTarget.id },
      { onSettled: () => setDeleteTarget(null) },
    );
  };

  const hasFilters = search !== '' || availability !== '' || condition !== '';

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <CardTitle>Products</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:w-56">
            <Input
              aria-label="Search this vendor's products"
              placeholder="Search products…"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="sm:w-44">
            <Select
              aria-label="Filter by availability"
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value as '' | 'available' | 'unavailable');
                setPage(1);
              }}
            >
              {AVAILABILITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-40">
            <Select
              aria-label="Filter by condition"
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value as '' | ProductCondition);
                setPage(1);
              }}
            >
              {CONDITION_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setAvailability('');
                setCondition('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add product
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {isLoading ? (
          <InlineSpinner />
        ) : error ? (
          <ErrorState onRetry={() => window.location.reload()} />
        ) : !data?.data?.length ? (
          <EmptyState
            icon={FolderTree}
            title="No products"
            subtitle={hasFilters ? 'No products match these filters.' : 'This vendor has not listed any products yet.'}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Condition</th>
                    <th className="px-5 py-3">Orders</th>
                    <th className="px-5 py-3">Availability</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => setViewingId(product.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setViewingId(product.id);
                      }}
                      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-bg-muted/40 focus-visible:outline-none focus-visible:bg-bg-muted/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb product={product} />
                          <div>
                            <p className="text-sm font-medium text-text-primary">{product.name}</p>
                            <p className="text-xs text-text-muted">{categoryLabel(product)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-text-primary">{formatNaira(product.basePrice)}</td>
                      <td className="px-5 py-3">
                        <ProductConditionBadge condition={product.condition} />
                      </td>
                      <td className="px-5 py-3 text-sm text-text-muted">{product.orderCount ?? '-'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <AvailabilityBadge available={product.isAvailable} />
                          <Switch
                            checked={product.isAvailable}
                            onChange={() => handleToggle(product)}
                            disabled={toggle.isPending}
                            ariaLabel={`Mark ${product.isAvailable ? 'unavailable' : 'available'}: ${product.name}`}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(product)}
                          title="Delete product"
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:hidden">
              {data.data.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setViewingId(product.id)}
                  className="cursor-pointer rounded-lg border border-border bg-bg-surface p-4 shadow-card transition-colors hover:border-brand/40"
                >
                  <div className="flex items-start gap-3">
                    <ProductThumb product={product} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{product.name}</p>
                      <p className="text-xs text-text-muted">{categoryLabel(product)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <AvailabilityBadge available={product.isAvailable} />
                      <ProductConditionBadge condition={product.condition} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{formatNaira(product.basePrice)}</span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={product.isAvailable}
                        onChange={() => handleToggle(product)}
                        disabled={toggle.isPending}
                        ariaLabel={`Mark ${product.isAvailable ? 'unavailable' : 'available'}: ${product.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(product)}
                        title="Delete product"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-4 py-3">
              <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
            </div>
          </>
        )}
      </CardBody>

      <ProductDetailModal
        product={viewingProduct}
        onClose={() => setViewingId(null)}
        onToggle={handleToggle}
        onDelete={(p) => {
          setViewingId(null);
          setDeleteTarget(p);
        }}
        onEdit={(p) => {
          setViewingId(null);
          setEditingId(p.id);
        }}
        togglePending={toggle.isPending}
      />

      <ProductFormModal
        open={!!editingProduct}
        product={editingProduct}
        vendorId={vendorId}
        onClose={() => setEditingId(null)}
        onSubmit={handleEditSave}
        loading={updateProduct.isPending}
      />

      <ProductFormModal
        open={creating}
        product={null}
        vendorId={vendorId}
        onClose={() => setCreating(false)}
        onSubmit={handleCreate}
        loading={createProduct.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete product"
        description={deleteTarget ? `Permanently delete "${deleteTarget.name}"? This action cannot be undone.` : undefined}
        confirmLabel="Delete"
        danger
        loading={deleteProduct.isPending}
      />
    </Card>
  );
};
