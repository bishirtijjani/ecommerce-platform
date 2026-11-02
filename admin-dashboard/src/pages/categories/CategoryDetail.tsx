import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Ruler,
  SlidersHorizontal,
  Trash2,
  Package,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { TaxonomyThumb } from '../../components/ui/TaxonomyThumb';
import { cn } from '../../lib/cn';
import { useDragReorder } from '../../lib/useDragReorder';
import type { Subcategory, VendorCategory } from '../../types';

interface CategoryDetailProps {
  category: VendorCategory;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onEditSchema: () => void;
  onAddSub: (name: string) => void;
  onEditSub: (sub: Subcategory) => void;
  onDeleteSub: (sub: Subcategory) => void;
  onReorderSubs: (orderedIds: string[]) => void;
  busy?: boolean;
}

const byOrder = (a: Subcategory, b: Subcategory) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const SubRow = ({
  sub,
  isFirst,
  isLast,
  count,
  onEdit,
  onDelete,
  onMove,
  drag,
}: {
  sub: Subcategory;
  isFirst: boolean;
  isLast: boolean;
  count: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  drag?: {
    isDragging: boolean;
    isOver: boolean;
    props: {
      draggable: boolean;
      onDragStart: (event: DragEvent) => void;
      onDragEnd: () => void;
      onDragOver: (event: DragEvent) => void;
      onDrop: (event: DragEvent) => void;
    };
  };
}) => (
  <div
    {...(drag?.props ?? {})}
    className={cn(
      'group flex items-center gap-2 rounded-md border border-border bg-bg-surface px-2 py-2 transition-colors',
      drag?.isDragging && 'opacity-40',
      drag?.isOver && 'border-brand ring-1 ring-brand/30',
      sub.isActive ? '' : 'bg-bg-muted/40',
    )}
  >
    {drag ? (
      <span
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center text-text-placeholder active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripVertical className="h-4 w-4" />
      </span>
    ) : (
      <span className="h-7 w-6 shrink-0" aria-hidden="true" />
    )}
    <TaxonomyThumb imageUrl={sub.imageUrl} size="sm" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className={cn('truncate text-sm font-medium', sub.isActive ? 'text-text-primary' : 'text-text-muted')}>
          {sub.name}
        </p>
        {!sub.isActive && (
          <span className="shrink-0 rounded-full bg-bg-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
            Off
          </span>
        )}
        {sub.vendorId && (
          <span className="shrink-0 rounded-full border border-border bg-bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            {sub.owner?.name ? `By ${sub.owner.name}` : 'Vendor'}
          </span>
        )}
      </div>
      <p className="text-xs text-text-muted tabular-nums">
        {count} {count === 1 ? 'product' : 'products'}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-0.5">
      {drag && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            title="Move up"
            aria-label={`Move ${sub.name} up`}
          >
            <ChevronUp className="h-3.5 w-3.5 text-text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => onMove(1)}
            title="Move down"
            aria-label={`Move ${sub.name} down`}
          >
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onEdit}
        title="Edit"
        aria-label={`Edit ${sub.name}`}
      >
        <Pencil className="h-4 w-4 text-text-muted" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onDelete}
        title="Delete"
        aria-label={`Delete ${sub.name}`}
      >
        <Trash2 className="h-4 w-4 text-error" />
      </Button>
    </div>
  </div>
);

export const CategoryDetail = ({
  category,
  onBack,
  onEdit,
  onDelete,
  onToggleActive,
  onEditSchema,
  onAddSub,
  onEditSub,
  onDeleteSub,
  onReorderSubs,
  busy,
}: CategoryDetailProps) => {
  const [subSearch, setSubSearch] = useState('');
  const [draft, setDraft] = useState('');

  const isVendor = !!category.vendorId;
  const subs = category.subcategories ?? [];

  const filteredSubs = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    return q ? subs.filter((s) => s.name.toLowerCase().includes(q)) : subs;
  }, [subs, subSearch]);

  const globalSubs = useMemo(() => filteredSubs.filter((s) => !s.vendorId).sort(byOrder), [filteredSubs]);
  const vendorSubs = useMemo(() => filteredSubs.filter((s) => !!s.vendorId).sort(byOrder), [filteredSubs]);

  const globalIds = useMemo(() => globalSubs.map((s) => s.id), [globalSubs]);
  const { dragId, overId, move, getItemProps } = useDragReorder(globalIds, (next) => onReorderSubs(next));

  const schema = category.attributeSchema;
  const productCount = category._count?.products ?? 0;
  const vendorCount = category.vendorCount ?? 0;

  const submitDraft = () => {
    const name = draft.trim();
    if (!name) return;
    onAddSub(name);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile back */}
      <button
        type="button"
        onClick={onBack}
        className="-mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text-primary lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> All categories
      </button>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-4">
            <TaxonomyThumb imageUrl={category.imageUrl} icon={category.icon} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">{category.name}</h2>
                {isVendor ? (
                  <Badge tone="brand">{category.owner?.name ? `By ${category.owner.name}` : 'Vendor-created'}</Badge>
                ) : (
                  <Badge>Global</Badge>
                )}
                {!category.isActive && <Badge tone="warning">Inactive</Badge>}
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {category.description || 'No description.'}
              </p>
              <p className="mt-1 text-xs text-text-placeholder">
                /{category.slug} · sort {category.sortOrder}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={onEdit} disabled={busy}>
              Edit
            </Button>
            {!isVendor && (
              <Button variant="outline" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={onEditSchema} disabled={busy}>
                Attribute schema
              </Button>
            )}
            <Button
              variant="outline"
              className="text-error hover:text-error-strong"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className={cn('text-xs font-medium', category.isActive ? 'text-success-strong' : 'text-text-muted')}>
                {category.isActive ? 'Active' : 'Inactive'}
              </span>
              <Switch checked={category.isActive} onChange={onToggleActive} />
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-bg-muted/40 p-3 text-center">
            {[
              { label: 'Products', value: productCount },
              { label: 'Vendors selling', value: vendorCount },
              { label: 'Subcategories', value: subs.length },
            ].map((fact) => (
              <div key={fact.label}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{fact.label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-text-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {!isVendor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4 text-text-muted" /> Attribute schema
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onEditSchema} disabled={busy}>
              {schema ? 'Edit' : 'Set up'}
            </Button>
          </CardHeader>
          <CardBody>
            {!schema ? (
              <p className="text-sm text-text-muted">
                No schema yet. Define variant axes (size, colour, strength…) and packaging units so vendors get the
                right product fields for this category.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {(schema.axes ?? []).map((axis) => (
                  <Badge key={axis} tone="brand">
                    {axis}
                  </Badge>
                ))}
                {schema.pack && (
                  <Badge tone="info">
                    <Package className="h-3 w-3" /> Packing{schema.packUnits?.length ? ` · ${schema.packUnits.length} units` : ''}
                  </Badge>
                )}
                {schema.sizeSystem && <Badge tone="neutral">Size: {schema.sizeSystem}</Badge>}
                {!schema.axes?.length && !schema.pack && !schema.sizeSystem && (
                  <span className="text-sm text-text-muted">Schema is empty.</span>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-text-muted" /> Subcategories ({subs.length})
          </CardTitle>
          {subs.length > 3 && (
            <div className="sm:w-56">
              <Input
                aria-label="Search subcategories"
                placeholder="Search subcategories…"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
            </div>
          )}
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Global subcategories - admin-owned, reorderable */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Global</h4>
            {globalSubs.length === 0 ? (
              <p className="text-sm text-text-muted">
                {subSearch.trim() ? 'No global subcategories match.' : 'No global subcategories yet.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {globalSubs.map((sub, index) => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    isFirst={index === 0}
                    isLast={index === globalSubs.length - 1}
                    count={sub._count?.products ?? 0}
                    onEdit={() => onEditSub(sub)}
                    onDelete={() => onDeleteSub(sub)}
                    onMove={(dir) => move(sub.id, dir)}
                    drag={{
                      isDragging: dragId === sub.id,
                      isOver: overId === sub.id && dragId !== sub.id,
                      props: getItemProps(sub.id),
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Input
                aria-label="New subcategory name"
                placeholder="Add a subcategory…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitDraft();
                  }
                }}
              />
              <Button onClick={submitDraft} disabled={!draft.trim() || busy} icon={<Plus className="h-4 w-4" />}>
                Add
              </Button>
            </div>
          </section>

          {/* Vendor-created subcategories - oversight + moderation */}
          {vendorSubs.length > 0 && (
            <section className="space-y-2 border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Vendor-created ({vendorSubs.length})
              </h4>
              <div className="space-y-1.5">
                {vendorSubs.map((sub) => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    isFirst
                    isLast
                    count={sub._count?.products ?? 0}
                    onEdit={() => onEditSub(sub)}
                    onDelete={() => onDeleteSub(sub)}
                    onMove={() => undefined}
                  />
                ))}
              </div>
            </section>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
