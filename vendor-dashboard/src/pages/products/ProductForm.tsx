import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Star, StarOff, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { ImageUpload } from '../../components/ImageUpload';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StickySaveBar } from '../../components/StickySaveBar';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { PageSpinner } from '../../components/ui/Spinner';
import { TaxonomyPicker } from '../../components/TaxonomyPicker';
import { VariantsEditor, parseAttributes, type VariantDraft } from './VariantsEditor';
import { OptionGroupsEditor, buildOptionGroupsPayload, type OptionGroupDraft } from './OptionGroupsEditor';
import { useProduct, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../../hooks/useProducts';
import { useShopCategories } from '../../hooks/useShopCategories';
import { useVendorProfile } from '../../hooks/useVendor';
import { createVariant, updateVariant, deleteVariant, bulkUpsertOptionGroups, getCategories } from '../../api/vendor';
import { useAuthStore } from '../../store/authStore';
import type { ProductCondition } from '../../types';
import { toast } from 'sonner';

export default function ProductForm() {
  const { t } = useTranslation();
  const { productId } = useParams();
  const isEdit = !!productId;
  const navigate = useNavigate();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const { data: product, isLoading } = useProduct(productId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(productId as string);
  const deleteProductMut = useDeleteProduct();

  // The unified taxonomy for the product's single Category -> Subcategory
  // pickers. Global categories/subcategories come from getCategories(); the
  // vendor's OWN categories/subcategories come from their taxonomy. A product
  // holds one categoryId + subcategoryId pair drawn from the union.
  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => getCategories(),
    staleTime: 5 * 60_000,
  });
  const { categories: taxonomy } = useShopCategories(vendorId);
  const { data: vendorProfile } = useVendorProfile();

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; imageUrl: string | null; owned: boolean; subcategories: { id: string; name: string; imageUrl: string | null; owned: boolean }[] }>();
    (categories || [])
      .filter((c) => c.isActive)
      .forEach((c) => map.set(c.id, { name: c.name, imageUrl: c.imageUrl || null, owned: false, subcategories: (c.subcategories || []).filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, imageUrl: s.imageUrl ?? null, owned: false })) }));
    // Merge vendor-owned categories/rows on top (they carry global + own rows).
    (taxonomy || []).forEach((c) => {
      const existing = map.get(c.id);
      map.set(c.id, {
        name: existing ? existing.name : c.name,
        imageUrl: existing ? existing.imageUrl : c.imageUrl || null,
        owned: existing ? existing.owned : c.owned,
        subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, imageUrl: s.imageUrl || null, owned: s.owned })),
      });
    });
    return map;
  }, [categories, taxonomy]);

  const categoryOptions = Array.from(categoryById.entries())
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.owned === b.owned ? a.name.localeCompare(b.name) : a.owned ? 1 : -1));

  const subOptionsFor = (categoryId: string) => {
    const c = categoryById.get(categoryId);
    if (!c) return [];
    return c.subcategories;
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [condition, setCondition] = useState<ProductCondition>('NEW');
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [groups, setGroups] = useState<OptionGroupDraft[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Snapshot of the pristine form so we can detect unsaved changes. It's computed
  // from the loaded product (the source of truth) rather than from reactive state,
  // so there's no timing gap while the populate effect's setState calls settle.
  const buildSnapshotFromState = () =>
    JSON.stringify({ name, description, categoryId, subcategoryId, basePrice, stock, images, videoUrl, isAvailable, condition, variants, groups });

  const buildSnapshotFromProduct = (p: typeof product) => {
    const variantsClean = (p?.variants || [])
      .filter((v) => Object.keys(v.attributes || {}).length > 0)
      .map((v) => ({
        key: v.id,
        id: v.id,
        attributesText: Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', '),
        price: String(v.price),
        stock: String(v.stock),
        isAvailable: v.isAvailable,
      }));
    const groupsClean = (p?.optionGroups || []).map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      selectionRule: g.selectionRule,
      maxSelect: g.maxSelect,
      items: g.items.map((i) => ({
        key: i.id,
        id: i.id,
        name: i.name,
        priceDelta: String(i.priceDelta),
        isDefault: i.isDefault,
        isAvailable: i.isAvailable,
      })),
    }));
    return JSON.stringify({
      name: p?.name || '',
      description: p?.description || '',
      categoryId: p?.categoryId || '',
      subcategoryId: p?.subcategoryId || '',
      basePrice: p ? String(p.basePrice) : '',
      stock: p ? String(p.stock) : '',
      images: p?.images && p.images.length > 0 ? p.images : p?.imageUrl ? [p.imageUrl] : [],
      videoUrl: p?.videoUrl || '',
      isAvailable: p ? p.isAvailable : true,
      condition: p?.condition || 'NEW',
      variants: variantsClean,
      groups: groupsClean,
    });
  };

  // For create, product stays null so the pristine snapshot is the empty default;
  // for edit it's rebuilt from the loaded product. Snapshot cleared on save so the
  // bar disappears before navigating away.
  const [pristine, setPristine] = useState<string | null>(() => buildSnapshotFromProduct(product));

  useEffect(() => {
    setPristine(buildSnapshotFromProduct(product));
  }, [product]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setCategoryId(product.categoryId || '');
      setSubcategoryId(product.subcategoryId || '');
      setBasePrice(String(product.basePrice));
      setStock(String(product.stock));
      setImages((product.images && product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []));
      setVideoUrl(product.videoUrl || '');
      setIsAvailable(product.isAvailable);
      setCondition(product.condition || 'NEW');
      setVariants(
        product.variants
          .filter((v) => Object.keys(v.attributes || {}).length > 0)
          .map((v) => ({
            key: v.id,
            id: v.id,
            attributesText: Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', '),
            price: String(v.price),
            stock: String(v.stock),
            isAvailable: v.isAvailable,
          })),
      );
      setGroups(
        product.optionGroups.map((g) => ({
          key: g.id,
          id: g.id,
          name: g.name,
          selectionRule: g.selectionRule,
          maxSelect: g.maxSelect,
          items: g.items.map((i) => ({
            key: i.id,
            id: i.id,
            name: i.name,
            priceDelta: String(i.priceDelta),
            isDefault: i.isDefault,
            isAvailable: i.isAvailable,
          })),
        })),
      );
    }
  }, [product, isEdit]);

  const dirty = useMemo(() => pristine !== null && buildSnapshotFromState() !== pristine, [name, description, categoryId, subcategoryId, basePrice, stock, images, videoUrl, isAvailable, condition, variants, groups, pristine]);

  // Warn on leaving with unsaved changes (tab close/refresh + in-app links).
  const { showExitConfirm, cancelExit, confirmExit } = useUnsavedChangesGuard(dirty);

  if (isEdit && isLoading) return <PageSpinner />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = t('products.form.errName');
    if (!categoryId) e.categoryId = t('products.form.selectCategory');
    if (!basePrice || Number(basePrice) < 0) e.basePrice = t('products.form.errPrice');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base = {
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        basePrice: Number(basePrice),
        stock: Number(stock) || 0,
        images: images.length ? images : undefined,
        imageUrl: images[0] || undefined,
        videoUrl: videoUrl || undefined,
        isAvailable,
        condition,
      };

      if (!isEdit) {
        const variantPayload = variants
          .filter((v) => v.price)
          .map((v) => ({
            attributes: parseAttributes(v.attributesText),
            price: Number(v.price),
            stock: Number(v.stock) || 0,
            isAvailable: v.isAvailable,
          }));
        await createProduct.mutateAsync({
          ...base,
          variants: variantPayload.length ? variantPayload : undefined,
          optionGroups: buildOptionGroupsPayload(groups),
        });
        setPristine(buildSnapshotFromState());
        navigate('/products', { replace: true });
      } else {
        await updateProduct.mutateAsync(base);

        // Reconcile variants: create new, update changed, delete removed.
        const originalIds = new Set((product?.variants || []).map((v) => v.id));
        const draftIds = new Set(variants.filter((v) => v.id).map((v) => v.id));
        for (const v of variants) {
          const payload = { attributes: parseAttributes(v.attributesText), price: Number(v.price) || 0, stock: Number(v.stock) || 0, isAvailable: v.isAvailable };
          if (!v.price) continue;
          if (v.id) await updateVariant(vendorId, productId as string, v.id, payload);
          else await createVariant(vendorId, productId as string, payload);
        }
        for (const id of originalIds) {
          if (!draftIds.has(id) && (product?.variants.length || 0) > 1) {
            await deleteVariant(vendorId, productId as string, id).catch(() => {});
          }
        }

        await bulkUpsertOptionGroups(vendorId, productId as string, buildOptionGroupsPayload(groups));
        setPristine(buildSnapshotFromState());
        toast.success(t('products.form.updatedToast'));
        navigate('/products');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.errorTitle'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isEdit && product) {
      setBasePrice(String(product.basePrice));
      setStock(String(product.stock));
      setName(product.name);
      setDescription(product.description || '');
      setCategoryId(product.categoryId || '');
      setSubcategoryId(product.subcategoryId || '');
      setImages(product.images && product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []);
      setVideoUrl(product.videoUrl || '');
      setIsAvailable(product.isAvailable);
      setCondition(product.condition || 'NEW');
      setVariants(
        product.variants
          .filter((v) => Object.keys(v.attributes || {}).length > 0)
          .map((v) => ({
            key: v.id,
            id: v.id,
            attributesText: Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', '),
            price: String(v.price),
            stock: String(v.stock),
            isAvailable: v.isAvailable,
          })),
      );
      setGroups(
        product.optionGroups.map((g) => ({
          key: g.id,
          id: g.id,
          name: g.name,
          selectionRule: g.selectionRule,
          maxSelect: g.maxSelect,
          items: g.items.map((i) => ({
            key: i.id,
            id: i.id,
            name: i.name,
            priceDelta: String(i.priceDelta),
            isDefault: i.isDefault,
            isAvailable: i.isAvailable,
          })),
        })),
      );
      setPristine(buildSnapshotFromProduct(product));
    } else {
      setName('');
      setDescription('');
      setCategoryId('');
      setSubcategoryId('');
      setBasePrice('');
      setStock('0');
      setImages([]);
      setVideoUrl('');
      setIsAvailable(true);
      setCondition('NEW');
      setVariants([]);
      setGroups([]);
      setPristine(null);
    }
  };

  return (
    <div className="space-y-5 pb-24 lg:pb-10">
      <div className="flex items-center gap-3">
        <Link to="/products" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-text-primary">{isEdit ? t('products.form.editTitle') : t('dashboard.addProduct')}</h1>
        {isEdit && (
          <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
            {t('common.delete')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.form.basicInfo')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-primary">{t('products.form.photos')}</p>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={img + i} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-bg-muted">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title={i === 0 ? t('products.form.coverImage') : t('products.form.makeCover')}
                      onClick={() => {
                        const next = [...images];
                        const [it] = next.splice(i, 1);
                        next.unshift(it);
                        setImages(next);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-text-primary hover:bg-white"
                    >
                      {i === 0 ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : <StarOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title={t('common.remove')}
                      onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {i === 0 && (
                    <span className="absolute left-0 top-0 bg-amber-400 px-1.5 text-[10px] font-bold text-black">{t('products.form.cover')}</span>
                  )}
                </div>
              ))}
              {images.length < 5 && (
                <ImageUpload
                  value={null}
                  multiple
                  maxCount={5 - images.length}
                  onChangeMany={(results) => {
                    const urls = results.filter((r) => r.type === 'image').map((r) => r.url);
                    setImages((prev) => [...prev, ...urls].slice(0, 5));
                  }}
                  kind="product"
                  aspect="square"
                  containerClassName="h-24 w-24"
                />
              )}
            </div>
            <p className="mt-1.5 text-xs text-text-muted">{t('products.form.photosHint')}</p>
          </div>

          <div>
            <ImageUpload
              value={videoUrl || null}
              mediaType={videoUrl ? 'video' : 'image'}
              onChange={(url, type) => {
                if (type === 'video') setVideoUrl(url);
                else if (!url) setVideoUrl('');
              }}
              kind="product"
              acceptVideo
              label={t('products.form.productVideo')}
              containerClassName="aspect-[3/1] w-full"
            />
          </div>

          <Input label={t('products.form.productName')} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Textarea label={t('onboarding.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TaxonomyPicker
              label={t('products.form.category')}
              required
              options={categoryOptions}
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id);
                setSubcategoryId('');
              }}
              placeholder={t('products.form.selectCategory')}
              emptyText={t('products.form.noCategories')}
              error={errors.categoryId}
            />
            <TaxonomyPicker
              label={t('products.form.subcategory')}
              options={categoryId ? subOptionsFor(categoryId) : []}
              value={subcategoryId}
              onChange={(id) => setSubcategoryId(id)}
              placeholder={categoryId ? t('products.form.selectSubcategoryOptional') : t('products.form.selectCategoryFirst')}
              emptyText={categoryId ? t('products.form.noSubcategories') : ''}
              allowNone
              noneLabel={t('products.form.noSubcategory')}
              error={errors.subcategoryId}
              disabled={!categoryId}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('products.form.basePrice')} type="number" min={0} required value={basePrice} onChange={(e) => setBasePrice(e.target.value)} error={errors.basePrice} />
            <Input label={t('table.stock')} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <Select
            label={t('products.list.condition')}
            value={condition}
            onChange={(e) => setCondition(e.target.value as ProductCondition)}
            hint={t('products.form.conditionHint')}
          >
            <option value="NEW">{t('status.condition.NEW')}</option>
            <option value="USED">{t('status.condition.USED')}</option>
            <option value="SECOND_HAND">{t('status.condition.SECOND_HAND')}</option>
          </Select>
          {condition === 'SECOND_HAND' && (
            <div className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-strong">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {t('products.form.secondHandWarning', {
                  location: vendorProfile?.state
                    ? `${vendorProfile.state}${vendorProfile.lga ? `, ${vendorProfile.lga}` : ''}`
                    : t('products.form.secondHandNoLocation'),
                })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Switch checked={isAvailable} onChange={setIsAvailable} />
            <span className="text-sm text-text-primary">{t('products.form.availableForSale')}</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.list.variants')}</CardTitle>
        </CardHeader>
        <CardBody>
          <VariantsEditor variants={variants} onChange={setVariants} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('products.options.title')}</CardTitle>
        </CardHeader>
        <CardBody>
          <OptionGroupsEditor groups={groups} onChange={setGroups} />
        </CardBody>
      </Card>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        saveLabel={isEdit ? t('common.saveChanges') : t('products.form.createProduct')}
        onSave={handleSubmit}
        onCancel={handleCancel}
      />

      <ConfirmDialog
        open={showExitConfirm}
        onClose={cancelExit}
        onConfirm={confirmExit}
        title={t('common.unsavedChanges')}
        description={t('products.form.unsavedDesc')}
        confirmLabel={t('products.form.discard')}
        danger
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteProductMut.mutate(productId as string, {
            onSuccess: () => {
              setPristine(buildSnapshotFromState());
              navigate('/products');
            },
          })
        }
        title={t('products.form.deleteTitle')}
        description={t('products.form.deleteBody')}
        confirmLabel={t('products.form.deleteConfirm')}
        danger
        loading={deleteProductMut.isPending}
      />
    </div>
  );
}
