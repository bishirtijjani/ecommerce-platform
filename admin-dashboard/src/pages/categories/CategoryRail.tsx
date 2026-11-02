import { useMemo } from 'react';
import { ChevronDown, ChevronUp, FolderTree, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TaxonomyThumb } from '../../components/ui/TaxonomyThumb';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';
import type { VendorCategory } from '../../types';

export type CategoryScope = 'all' | 'global' | 'vendor' | 'inactive';

export interface CategoryScopeCounts {
  all: number;
  global: number;
  vendor: number;
  inactive: number;
}

export const CATEGORY_SCOPE_OPTIONS = (counts: CategoryScopeCounts) => [
  { value: 'all', label: 'All', count: counts.all },
  { value: 'global', label: 'Global', count: counts.global },
  { value: 'vendor', label: 'Vendor', count: counts.vendor },
  { value: 'inactive', label: 'Inactive', count: counts.inactive },
];

interface CategoryRailProps {
  categories: VendorCategory[];
  selectedId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  scope: CategoryScope;
  onScopeChange: (value: CategoryScope) => void;
  scopeCounts: CategoryScopeCounts;
  onSelect: (category: VendorCategory) => void;
  onEdit: (category: VendorCategory) => void;
  onDelete: (category: VendorCategory) => void;
  onCreate: () => void;
  /** Reorder is only meaningful in the "global" scope, where the list is the order. */
  onMove: (id: string, direction: -1 | 1) => void;
  reorderEnabled: boolean;
}

export const CategoryRail = ({
  categories,
  selectedId,
  search,
  onSearchChange,
  scope,
  onScopeChange,
  scopeCounts,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  onMove,
  reorderEnabled,
}: CategoryRailProps) => {
  const globalCount = scopeCounts.global;

  const emptySubtitle = useMemo(() => {
    if (search.trim()) return 'Try a different search.';
    if (scope === 'vendor') return 'No categories have been created by vendors yet.';
    if (scope === 'inactive') return 'Every category is active.';
    return 'Add your first category to get started.';
  }, [scope, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            aria-label="Search categories"
            placeholder="Search categories & subcategories…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button onClick={onCreate} icon={<Plus className="h-4 w-4" />} aria-label="Add category" className="shrink-0">
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      <SegmentedControl
        ariaLabel="Filter categories"
        options={CATEGORY_SCOPE_OPTIONS(scopeCounts)}
        value={scope}
        onChange={(value) => onScopeChange(value as CategoryScope)}
      />

      {reorderEnabled && globalCount > 1 && (
        <p className="px-1 text-xs text-text-placeholder">
          Tip: use the arrows to reorder, global order controls the customer-facing browse grid.
        </p>
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories found"
          subtitle={emptySubtitle}
          action={
            !search.trim() ? (
              <Button onClick={onCreate} icon={<Plus className="h-4 w-4" />}>
                Add category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-1.5" role="list">
          {categories.map((category, index) => {
            const isVendor = !!category.vendorId;
            const selected = category.id === selectedId;
            const subCount = category.subcategories?.length ?? 0;
            const productCount = category._count?.products ?? 0;
            const canMove = reorderEnabled && !isVendor;
            return (
              <li key={category.id}>
                <div
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border px-2.5 py-2.5 transition-colors',
                    selected
                      ? 'border-brand/50 bg-brand-soft'
                      : 'border-border bg-bg-surface hover:border-brand/30 hover:bg-bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(category)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <TaxonomyThumb imageUrl={category.imageUrl} icon={category.icon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'truncate text-sm font-medium',
                            category.isActive ? 'text-text-primary' : 'text-text-muted line-through decoration-border-strong',
                          )}
                        >
                          {category.name}
                        </span>
                        {!category.isActive && (
                          <span className="shrink-0 rounded-full bg-bg-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                            Off
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                        <span
                          className={cn(
                            'truncate rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide',
                            isVendor ? 'bg-brand-soft text-brand-strong' : 'bg-bg-muted text-text-muted',
                          )}
                        >
                          {isVendor ? (category.owner?.name ? `By ${category.owner.name}` : 'Vendor') : 'Global'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {subCount} sub · {productCount} {productCount === 1 ? 'product' : 'products'}
                        </span>
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {canMove && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === 0}
                          onClick={() => onMove(category.id, -1)}
                          title="Move up"
                          aria-label={`Move ${category.name} up`}
                        >
                          <ChevronUp className="h-3.5 w-3.5 text-text-muted" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === categories.length - 1}
                          onClick={() => onMove(category.id, 1)}
                          title="Move down"
                          aria-label={`Move ${category.name} down`}
                        >
                          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(category)}
                      title="Edit"
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="h-4 w-4 text-text-muted" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDelete(category)}
                      title="Delete"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
