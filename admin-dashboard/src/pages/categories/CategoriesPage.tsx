import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderTree, LayoutGrid } from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategoryAttributeSchema,
  useCreateSubcategory,
  useUpdateSubcategory,
  useDeleteSubcategory,
  useReorderSubcategories,
} from '../../hooks/useCategories';
import type { CategoryInput, ReorderItem } from '../../api/categories';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AttributeSchemaBuilder } from '../../components/ui/AttributeSchemaBuilder';
import { cn } from '../../lib/cn';
import type { Subcategory, VendorCategory } from '../../types';
import { CategoryRail, type CategoryScope, type CategoryScopeCounts } from './CategoryRail';
import { CategoryDetail } from './CategoryDetail';
import { CategoryFormModal } from './CategoryFormModal';
import { SubcategoryFormModal } from './SubcategoryFormModal';

export default function CategoriesPage() {
  const { categoryId } = useParams<{ categoryId?: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useCategories({ limit: 200 });
  const categories = useMemo(() => data?.data ?? [], [data]);

  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const reorderCats = useReorderCategories();
  const createSub = useCreateSubcategory();
  const updateSub = useUpdateSubcategory();
  const removeSub = useDeleteSubcategory();
  const reorderSubs = useReorderSubcategories();
  const updateSchema = useUpdateCategoryAttributeSchema();

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<CategoryScope>('all');

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null);

  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subCategory, setSubCategory] = useState<VendorCategory | null>(null);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);

  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<VendorCategory | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<{ category: VendorCategory; sub: Subcategory } | null>(null);
  const [schemaCategory, setSchemaCategory] = useState<VendorCategory | null>(null);

  const scopeCounts: CategoryScopeCounts = useMemo(
    () => ({
      all: categories.length,
      global: categories.filter((c) => !c.vendorId).length,
      vendor: categories.filter((c) => !!c.vendorId).length,
      inactive: categories.filter((c) => !c.isActive).length,
    }),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      const isVendor = !!c.vendorId;
      if (scope === 'global' && isVendor) return false;
      if (scope === 'vendor' && !isVendor) return false;
      if (scope === 'inactive' && c.isActive) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.subcategories ?? []).some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [categories, scope, search]);

  const selected = categories.find((c) => c.id === categoryId) ?? null;

  // Auto-open the first category's detail on desktop so the right pane is never
  // empty on first load. Only once, and only when nothing is selected.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || isLoading || !data) return;
    if (categoryId) {
      autoSelected.current = true;
      return;
    }
    if (categories.length && window.matchMedia('(min-width: 1024px)').matches) {
      autoSelected.current = true;
      navigate(`/categories/${categories[0].id}`, { replace: true });
    }
  }, [categories, categoryId, data, isLoading, navigate]);

  const busy =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    reorderCats.isPending ||
    reorderSubs.isPending ||
    createSub.isPending ||
    updateSub.isPending ||
    removeSub.isPending;

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatFormOpen(true);
  };
  const openEditCategory = (category: VendorCategory) => {
    setEditingCategory(category);
    setCatFormOpen(true);
  };

  const submitCategory = (payload: CategoryInput) => {
    if (editingCategory) {
      update.mutate(
        { id: editingCategory.id, data: { ...payload, isActive: editingCategory.isActive } },
        {
          onSuccess: () => {
            setCatFormOpen(false);
            setEditingCategory(null);
          },
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (created) => {
          setCatFormOpen(false);
          if (created?.id) navigate(`/categories/${created.id}`);
        },
      });
    }
  };

  const toggleActive = (category: VendorCategory) =>
    update.mutate({ id: category.id, data: { isActive: !category.isActive } });

  const moveCategory = (id: string, direction: -1 | 1) => {
    const from = filtered.findIndex((c) => c.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= filtered.length) return;
    const next = filtered.slice();
    [next[from], next[to]] = [next[to], next[from]];
    reorderCats.mutate(next.map((c, index) => ({ id: c.id, sortOrder: index })));
  };

  const addSubcategory = (category: VendorCategory, name: string) => {
    createSub.mutate({ categoryId: category.id, data: { name } });
  };

  const openEditSub = (category: VendorCategory, sub: Subcategory) => {
    setSubCategory(category);
    setEditingSub(sub);
    setSubFormOpen(true);
  };

  const submitSubcategory = (payload: { name: string; imageUrl?: string | null; sortOrder?: number }) => {
    if (!subCategory) return;
    if (editingSub) {
      updateSub.mutate(
        {
          categoryId: subCategory.id,
          subcategoryId: editingSub.id,
          data: { ...payload, isActive: editingSub.isActive },
        },
        {
          onSuccess: () => {
            setSubFormOpen(false);
            setEditingSub(null);
          },
        },
      );
    } else {
      createSub.mutate({ categoryId: subCategory.id, data: payload }, { onSuccess: () => setSubFormOpen(false) });
    }
  };

  const reorderSubcategories = (category: VendorCategory, orderedIds: string[]) => {
    const items: ReorderItem[] = orderedIds.map((id, index) => ({ id, sortOrder: index }));
    reorderSubs.mutate({ categoryId: category.id, items });
  };

  const confirmDeleteSub = () => {
    if (!deleteSubTarget) return;
    const { category, sub } = deleteSubTarget;
    const hasProducts = (sub._count?.products ?? 0) > 0;
    removeSub.mutate(
      { categoryId: category.id, subcategoryId: sub.id, unfile: hasProducts },
      { onSuccess: () => setDeleteSubTarget(null) },
    );
  };

  const renderDetail = () => {
    if (isLoading) return <InlineSpinner />;
    if (error) return <ErrorState onRetry={() => window.location.reload()} />;
    if (!selected) {
      return (
        <EmptyState
          icon={FolderTree}
          title={categoryId ? 'Category not found' : 'Select a category'}
          subtitle={
            categoryId
              ? 'It may have been deleted. Pick another from the list.'
              : 'Choose a category from the list to manage its subcategories, schema and vendors.'
          }
        />
      );
    }
    return (
      <CategoryDetail
        category={selected}
        busy={busy}
        onBack={() => navigate('/categories')}
        onEdit={() => openEditCategory(selected)}
        onDelete={() => setDeleteCategoryTarget(selected)}
        onToggleActive={() => toggleActive(selected)}
        onEditSchema={() => setSchemaCategory(selected)}
        onAddSub={(name) => addSubcategory(selected, name)}
        onEditSub={(sub) => openEditSub(selected, sub)}
        onDeleteSub={(sub) => setDeleteSubTarget({ category: selected, sub })}
        onReorderSubs={(orderedIds) => reorderSubcategories(selected, orderedIds)}
      />
    );
  };

  const deleteCategoryInUse =
    !!deleteCategoryTarget &&
    ((deleteCategoryTarget.vendorCount ?? 0) > 0 || (deleteCategoryTarget._count?.products ?? 0) > 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Categories</h1>
          <p className="text-sm text-text-muted">
            Manage the global taxonomy, vendor-created categories, subcategories and attribute schemas.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<LayoutGrid className="h-4 w-4" />}
          onClick={() => navigate('/home-categories')}
        >
          Home layout
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div
          className={cn(
            'lg:sticky lg:top-20 lg:w-[380px] lg:max-h-[calc(100vh-6rem)] lg:shrink-0 lg:overflow-y-auto lg:pr-1',
            categoryId && 'hidden lg:block',
          )}
        >
          <CategoryRail
            categories={filtered}
            selectedId={categoryId}
            search={search}
            onSearchChange={setSearch}
            scope={scope}
            onScopeChange={setScope}
            scopeCounts={scopeCounts}
            onSelect={(category) => navigate(`/categories/${category.id}`)}
            onEdit={openEditCategory}
            onDelete={setDeleteCategoryTarget}
            onCreate={openCreateCategory}
            onMove={moveCategory}
            reorderEnabled={scope === 'global'}
          />
        </div>

        <div className={cn('min-w-0 flex-1', !categoryId && 'hidden lg:block')}>{renderDetail()}</div>
      </div>

      <CategoryFormModal
        open={catFormOpen}
        category={editingCategory}
        onClose={() => {
          setCatFormOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={submitCategory}
        loading={create.isPending || update.isPending}
      />

      <SubcategoryFormModal
        open={subFormOpen}
        subcategory={editingSub}
        categoryName={subCategory?.name ?? ''}
        onClose={() => {
          setSubFormOpen(false);
          setEditingSub(null);
        }}
        onSubmit={submitSubcategory}
        loading={createSub.isPending || updateSub.isPending}
      />

      <ConfirmDialog
        open={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={() =>
          deleteCategoryTarget && remove.mutate(deleteCategoryTarget.id, { onSuccess: () => setDeleteCategoryTarget(null) })
        }
        title={deleteCategoryInUse ? 'Deactivate category?' : 'Delete category?'}
        description={
          deleteCategoryInUse
            ? `“${deleteCategoryTarget?.name}” is in use by ${deleteCategoryTarget?._count?.products ?? 0} product(s) and ${deleteCategoryTarget?.vendorCount ?? 0} vendor(s). It will be deactivated, hidden from customers, fully reversible.`
            : `“${deleteCategoryTarget?.name}” will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={deleteCategoryInUse ? 'Deactivate' : 'Delete'}
        danger={!deleteCategoryInUse}
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={!!deleteSubTarget}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={confirmDeleteSub}
        title="Delete subcategory?"
        description={
          (deleteSubTarget?.sub._count?.products ?? 0) > 0
            ? `“${deleteSubTarget?.sub.name}” is used by ${deleteSubTarget?.sub._count?.products} product(s). They will be unfiled (kept under the category) and the subcategory removed.`
            : `“${deleteSubTarget?.sub.name}” will be permanently deleted.`
        }
        confirmLabel={(deleteSubTarget?.sub._count?.products ?? 0) > 0 ? 'Remove & unfile' : 'Delete'}
        danger
        loading={removeSub.isPending}
      />

      <AttributeSchemaBuilder
        open={!!schemaCategory}
        onClose={() => setSchemaCategory(null)}
        categoryName={schemaCategory?.name || ''}
        schema={schemaCategory?.attributeSchema ?? null}
        onSave={(attributeSchema) =>
          schemaCategory &&
          updateSchema.mutate(
            { id: schemaCategory.id, attributeSchema },
            { onSuccess: () => setSchemaCategory(null) },
          )
        }
        loading={updateSchema.isPending}
      />
    </div>
  );
}
