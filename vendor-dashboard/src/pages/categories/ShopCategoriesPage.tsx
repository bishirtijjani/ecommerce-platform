import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Spinner } from '../../components/ui/Spinner';
import { TaxonomyThumb } from '../../components/ui/TaxonomyThumb';
import { ImageUpload } from '../../components/ImageUpload';
import { useShopCategories } from '../../hooks/useShopCategories';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/cn';
import type { TaxonomyCategory, TaxonomySubcategory } from '../../types';
import { ShopCategoryDetail } from './ShopCategoryDetail';

type Scope = 'all' | 'yours' | 'global';

export default function ShopCategoriesPage() {
  const { t } = useTranslation();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const { categoryId } = useParams<{ categoryId?: string }>();
  const navigate = useNavigate();
  const { categories, isLoading, add, edit, remove, addSub, editSub, removeSub } = useShopCategories(vendorId);

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  // Create own category
  const [showCreate, setShowCreate] = useState(false);
  const [catName, setCatName] = useState('');
  const [catImage, setCatImage] = useState<string | null>(null);

  // Edit category
  const [editing, setEditing] = useState<TaxonomyCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editAck, setEditAck] = useState(false);

  // Edit subcategory
  const [editingSub, setEditingSub] = useState<{ category: TaxonomyCategory; sub: TaxonomySubcategory } | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubImage, setEditSubImage] = useState<string | null>(null);
  const [editSubAck, setEditSubAck] = useState(false);

  const [removing, setRemoving] = useState<TaxonomyCategory | null>(null);
  const [removingSub, setRemovingSub] = useState<{ category: TaxonomyCategory; sub: TaxonomySubcategory } | null>(null);

  const pending =
    add.isPending || edit.isPending || remove.isPending || addSub.isPending || editSub.isPending || removeSub.isPending;

  const global = useMemo(() => categories.filter((c) => !c.owned), [categories]);
  const mine = useMemo(() => categories.filter((c) => c.owned), [categories]);

  const counts = useMemo(
    () => ({ all: categories.length, yours: mine.length, global: global.length }),
    [categories.length, mine.length, global.length],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (scope === 'yours' && !c.owned) return false;
      if (scope === 'global' && c.owned) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) || (c.subcategories ?? []).some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [categories, scope, search]);

  const selected = categories.find((c) => c.id === categoryId) ?? null;

  // Auto-open the first category on desktop so the detail pane is never empty.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || isLoading) return;
    if (categoryId) {
      autoSelected.current = true;
      return;
    }
    if (categories.length && window.matchMedia('(min-width: 1024px)').matches) {
      autoSelected.current = true;
      navigate(`/categories/${categories[0].id}`, { replace: true });
    }
  }, [categories, categoryId, isLoading, navigate]);

  const globalNames = useMemo(() => new Set(global.map((c) => c.name.toLowerCase())), [global]);

  const createClash = catName.trim() ? globalNames.has(catName.trim().toLowerCase()) : false;
  const renameClash =
    editing?.owned && editName.trim()
      ? categories.some((c) => c.id !== editing.id && c.name.toLowerCase() === editName.trim().toLowerCase())
      : false;

  const submitCreate = () => {
    const name = catName.trim();
    if (!name) return;
    if (globalNames.has(name.toLowerCase())) {
      toast.error(t('categories.clashToast', { name }));
      return;
    }
    add.mutate({ name, imageUrl: catImage }, { onSuccess: () => setShowCreate(false) });
  };

  const openEdit = (category: TaxonomyCategory) => {
    setEditing(category);
    setEditName(category.name);
    setEditImage(category.imageUrl);
    setEditAck(false);
  };

  const submitEdit = () => {
    if (!editing) return;
    const imageChanged = editImage !== editing.imageUrl;
    if (!editing.owned && imageChanged && !editAck) return;
    const input: { name?: string; imageUrl?: string | null } = { imageUrl: editImage };
    if (editing.owned) input.name = editName.trim();
    edit.mutate(
      { categoryId: editing.id, input },
      { onSuccess: () => setEditing(null) },
    );
  };

  const openEditSub = (category: TaxonomyCategory, sub: TaxonomySubcategory) => {
    setEditingSub({ category, sub });
    setEditSubName(sub.name);
    setEditSubImage(sub.imageUrl);
    setEditSubAck(false);
  };

  const submitEditSub = () => {
    if (!editingSub) return;
    const imageChanged = editSubImage !== editingSub.sub.imageUrl;
    if (!editingSub.sub.owned && imageChanged && !editSubAck) return;
    const input: { name?: string; imageUrl?: string | null } = { imageUrl: editSubImage };
    if (editingSub.sub.owned) input.name = editSubName.trim();
    editSub.mutate(
      { categoryId: editingSub.category.id, subcategoryId: editingSub.sub.id, input },
      { onSuccess: () => setEditingSub(null) },
    );
  };

  const submitAddSub = (category: TaxonomyCategory, name: string) => {
    addSub.mutate({ categoryId: category.id, input: { name } });
  };

  const renderDetail = () => {
    if (isLoading) return <Spinner />;
    if (!selected) {
      return (
        <EmptyState
          icon={Layers}
          title={categoryId ? t('categories.notFoundTitle') : t('categories.selectTitle')}
          subtitle={
            categoryId
              ? t('categories.notFoundSub')
              : t('categories.selectSub')
          }
        />
      );
    }
    return (
      <ShopCategoryDetail
        category={selected}
        busy={pending}
        onBack={() => navigate('/categories')}
        onEdit={() => openEdit(selected)}
        onDelete={() => setRemoving(selected)}
        onAddSub={(name) => submitAddSub(selected, name)}
        onEditSub={(sub) => openEditSub(selected, sub)}
        onDeleteSub={(sub) => setRemovingSub({ category: selected, sub })}
      />
    );
  };

  const editingImageChanged = editing ? editImage !== editing.imageUrl : false;
  const editingSubImageChanged = editingSub ? editSubImage !== editingSub.sub.imageUrl : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('categories.title')}</h1>
        <p className="text-sm text-text-muted">
          {t('categories.subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div
          className={cn(
            'lg:sticky lg:top-20 lg:w-[380px] lg:max-h-[calc(100vh-6rem)] lg:shrink-0 lg:overflow-y-auto lg:pr-1',
            categoryId && 'hidden lg:block',
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  aria-label={t('categories.searchAria')}
                  placeholder={t('categories.searchPlaceholder')}
                  leftIcon={<Search className="h-4 w-4" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                icon={<Plus className="h-4 w-4" />}
                aria-label={t('categories.newAria')}
                className="shrink-0"
                onClick={() => {
                  setShowCreate(true);
                  setCatName('');
                  setCatImage(null);
                }}
              >
                <span className="hidden sm:inline">{t('categories.new')}</span>
              </Button>
            </div>

            <SegmentedControl
              ariaLabel={t('categories.filterAria')}
              options={[
                { value: 'all', label: t('common.all'), count: counts.all },
                { value: 'yours', label: t('categories.yours'), count: counts.yours },
                { value: 'global', label: t('categories.global'), count: counts.global },
              ]}
              value={scope}
              onChange={(value) => setScope(value as Scope)}
            />

            {categories.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t('categories.emptyTitle')}
                subtitle={t('categories.emptySubtitle')}
                action={
                  <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>
                    {t('categories.newCategory')}
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Layers} title={t('categories.noMatches')} subtitle={t('categories.noMatchesSub')} />
            ) : (
              <ul className="flex flex-col gap-1.5" role="list">
                {filtered.map((category) => {
                  const selectedRow = category.id === categoryId;
                  const subCount = category.subcategories?.length ?? 0;
                  return (
                    <li key={category.id}>
                      <div
                        className={cn(
                          'group flex items-center gap-3 rounded-lg border px-2.5 py-2.5 transition-colors',
                          selectedRow
                            ? 'border-brand/50 bg-brand-soft'
                            : 'border-border bg-bg-surface hover:border-brand/30 hover:bg-bg-muted',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/categories/${category.id}`)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <TaxonomyThumb imageUrl={category.imageUrl} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-text-primary">{category.name}</span>
                              {category.isActive === false && (
                                <span className="shrink-0 rounded-full bg-bg-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                                  {t('categories.off')}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                              <span
                                className={cn(
                                  'truncate rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide',
                                  category.owned ? 'bg-brand-soft text-brand-strong' : 'bg-bg-muted text-text-muted',
                                )}
                              >
                                {category.owned ? t('categories.yours') : t('categories.global')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {t('categories.subCount', { count: subCount })} · {t('categories.productCount', { count: category.productCount ?? 0 })}
                              </span>
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(category)}
                            title={t('common.edit')}
                            aria-label={t('categories.editAria', { name: category.name })}
                          >
                            <Pencil className="h-4 w-4 text-text-muted" />
                          </Button>
                          {category.owned && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setRemoving(category)}
                              title={t('common.remove')}
                              aria-label={t('categories.removeAria', { name: category.name })}
                            >
                              <Trash2 className="h-4 w-4 text-error" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className={cn('min-w-0 flex-1', !categoryId && 'hidden lg:block')}>{renderDetail()}</div>
      </div>

      {/* Create own category */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('categories.createTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitCreate} loading={pending} disabled={!catName.trim() || createClash}>
              {t('categories.createButton')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('categories.nameLabel')}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder={t('categories.namePlaceholder')}
            error={createClash ? t('categories.clashError') : undefined}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-primary">{t('categories.pictureOptional')}</span>
            <ImageUpload value={catImage} onChange={(url) => setCatImage(url ? url : null)} kind="category" aspect="square" />
          </div>
        </div>
      </Modal>

      {/* Edit category */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('categories.editTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submitEdit}
              loading={pending}
              disabled={!editing?.owned ? editingImageChanged && !editAck : renameClash || !editName.trim()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label={t('categories.nameLabel')}
              value={editName}
              readOnly={!editing.owned}
              disabled={!editing.owned}
              onChange={(e) => setEditName(e.target.value)}
              error={renameClash ? t('categories.renameClash') : undefined}
              hint={!editing.owned ? t('categories.globalRenameHint') : undefined}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text-primary">{t('categories.picture')}</span>
              <ImageUpload value={editImage} onChange={(url) => setEditImage(url ? url : null)} kind="category" aspect="square" />
            </div>
            {!editing.owned && editingImageChanged && (
              <div className="space-y-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2">
                <p className="text-xs text-warning-strong">
                  {t('categories.globalCategoryWarning')}
                </p>
                <label className="flex items-center gap-2 text-xs font-medium text-warning-strong">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    checked={editAck}
                    onChange={(e) => setEditAck(e.target.checked)}
                  />
                  {t('categories.understoodCategory')}
                </label>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit subcategory */}
      <Modal
        open={!!editingSub}
        onClose={() => setEditingSub(null)}
        title={t('categories.editSubTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingSub(null)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submitEditSub}
              loading={pending}
              disabled={
                !editingSub?.sub.owned ? editingSubImageChanged && !editSubAck : !editSubName.trim()
              }
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editingSub && (
          <div className="space-y-4">
            <Input
              label={t('categories.subNameLabel')}
              value={editSubName}
              readOnly={!editingSub.sub.owned}
              disabled={!editingSub.sub.owned}
              onChange={(e) => setEditSubName(e.target.value)}
              hint={!editingSub.sub.owned ? t('categories.globalSubRenameHint') : undefined}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text-primary">{t('categories.picture')}</span>
              <ImageUpload
                value={editSubImage}
                onChange={(url) => setEditSubImage(url ? url : null)}
                kind="category"
                aspect="square"
              />
            </div>
            {!editingSub.sub.owned && editingSubImageChanged && (
              <div className="space-y-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2">
                <p className="text-xs text-warning-strong">
                  {t('categories.globalSubWarning')}
                </p>
                <label className="flex items-center gap-2 text-xs font-medium text-warning-strong">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    checked={editSubAck}
                    onChange={(e) => setEditSubAck(e.target.checked)}
                  />
                  {t('categories.understoodPicture')}
                </label>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
        title={t('categories.removeTitle')}
        description={t('categories.removeBody', { name: removing?.name })}
        confirmLabel={t('common.remove')}
        danger
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={!!removingSub}
        onClose={() => setRemovingSub(null)}
        onConfirm={() => {
          if (removingSub) {
            removeSub.mutate(
              { categoryId: removingSub.category.id, subcategoryId: removingSub.sub.id },
              { onSuccess: () => setRemovingSub(null) },
            );
          }
        }}
        title={t('categories.removeSubTitle')}
        description={t('categories.removeSubBody', { sub: removingSub?.sub.name, category: removingSub?.category.name })}
        confirmLabel={t('common.remove')}
        danger
        loading={removeSub.isPending}
      />
    </div>
  );
}
