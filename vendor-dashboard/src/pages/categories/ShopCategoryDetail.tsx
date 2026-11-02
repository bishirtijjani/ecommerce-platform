import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { TaxonomyThumb } from '../../components/ui/TaxonomyThumb';
import { cn } from '../../lib/cn';
import type { TaxonomyCategory, TaxonomySubcategory } from '../../types';

interface ShopCategoryDetailProps {
  category: TaxonomyCategory;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: (name: string) => void;
  onEditSub: (sub: TaxonomySubcategory) => void;
  onDeleteSub: (sub: TaxonomySubcategory) => void;
  busy?: boolean;
}

const SubRow = ({
  sub,
  onEdit,
  onDelete,
}: {
  sub: TaxonomySubcategory;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation();
  return (
  <div
    className={cn(
      'flex items-center gap-3 rounded-md border border-border bg-bg-surfaceMuted px-2.5 py-2',
      sub.isActive === false && 'opacity-70',
    )}
  >
    <TaxonomyThumb imageUrl={sub.imageUrl} size="sm" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium text-text-primary">{sub.name}</p>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            sub.owned ? 'bg-brand-soft text-brand-strong' : 'bg-bg-muted text-text-muted',
          )}
        >
          {sub.owned ? t('categories.yours') : t('categories.global')}
        </span>
        {sub.isActive === false && (
          <span className="shrink-0 rounded-full bg-bg-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
            {t('categories.off')}
          </span>
        )}
      </div>
      <p className="text-xs text-text-muted tabular-nums">
        {t('categories.productCount', { count: sub.productCount ?? 0 })}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onEdit}
        title={t('categories.editPicture')}
        aria-label={t('categories.editAria', { name: sub.name })}
      >
        <Pencil className="h-4 w-4 text-text-muted" />
      </Button>
      {sub.owned && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          title={t('common.remove')}
          aria-label={t('categories.removeAria', { name: sub.name })}
        >
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      )}
    </div>
  </div>
  );
};

export const ShopCategoryDetail = ({
  category,
  onBack,
  onEdit,
  onDelete,
  onAddSub,
  onEditSub,
  onDeleteSub,
  busy,
}: ShopCategoryDetailProps) => {
  const { t } = useTranslation();
  const [subSearch, setSubSearch] = useState('');
  const [draft, setDraft] = useState('');

  const subs = useMemo(() => category.subcategories ?? [], [category.subcategories]);
  const filtered = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    return q ? subs.filter((s) => s.name.toLowerCase().includes(q)) : subs;
  }, [subs, subSearch]);

  const mine = filtered.filter((s) => s.owned);
  const global = filtered.filter((s) => !s.owned);

  const submitDraft = () => {
    const name = draft.trim();
    if (!name) return;
    onAddSub(name);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="-mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text-primary lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> {t('categories.allCategories')}
      </button>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-4">
            <TaxonomyThumb imageUrl={category.imageUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">{category.name}</h2>
                {category.owned ? <Badge tone="brand">{t('categories.yours')}</Badge> : <Badge>{t('categories.global')}</Badge>}
                {category.isActive === false && <Badge tone="warning">{t('categories.hidden')}</Badge>}
              </div>
              <p className="mt-1 text-sm text-text-muted tabular-nums">
                {t('categories.productCount', { count: category.productCount ?? 0 })} ·{' '}
                {t('categories.subcategoryCount', { count: subs.length })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={onEdit} disabled={busy}>
              {category.owned ? t('categories.editPictureName') : t('categories.editPicture')}
            </Button>
            {category.owned && (
              <Button
                variant="outline"
                className="text-error hover:text-error-strong"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={onDelete}
                disabled={busy}
              >
                {t('common.remove')}
              </Button>
            )}
          </div>

          {!category.owned && (
            <p className="rounded-md border border-border bg-bg-muted/50 px-3 py-2 text-xs text-text-muted">
              {t('categories.globalInfo')}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-text-muted" /> {t('categories.subcategoriesCount', { count: subs.length })}
          </CardTitle>
          {subs.length > 3 && (
            <div className="sm:w-56">
              <Input
                aria-label={t('categories.searchSubAria')}
                placeholder={t('categories.searchSubPlaceholder')}
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
            </div>
          )}
        </CardHeader>
        <CardBody className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('categories.yours')}</h4>
            {mine.length === 0 ? (
              <p className="text-sm text-text-muted">
                {subSearch.trim() ? t('categories.noMineMatch') : t('categories.noMine')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {mine.map((sub) => (
                  <SubRow key={sub.id} sub={sub} onEdit={() => onEditSub(sub)} onDelete={() => onDeleteSub(sub)} />
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Input
                aria-label={t('categories.newSubAria')}
                placeholder={t('categories.addSubPlaceholder')}
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
                {t('common.add')}
              </Button>
            </div>
          </section>

          {global.length > 0 && (
            <section className="space-y-2 border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('categories.globalCount', { count: global.length })}
              </h4>
              <div className="space-y-1.5">
                {global.map((sub) => (
                  <SubRow key={sub.id} sub={sub} onEdit={() => onEditSub(sub)} onDelete={() => onDeleteSub(sub)} />
                ))}
              </div>
            </section>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
