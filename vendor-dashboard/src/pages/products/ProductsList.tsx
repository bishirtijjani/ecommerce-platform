import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Plus, Search, Pencil } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge, ProductConditionBadge } from '../../components/ui/Badge';
import { Switch } from '../../components/ui/Switch';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { useVendorProducts, useToggleProductAvailability } from '../../hooks/useProducts';
import { formatNaira } from '../../lib/format';
import { ProductCard } from './ProductCard';

export default function ProductsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useVendorProducts();
  const toggle = useToggleProductAvailability();
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    let rows = data.data;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (condition) rows = rows.filter((p) => (p.condition || 'NEW') === condition);
    return rows;
  }, [data, search, condition]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('nav.products')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('products.list.subtitle', { count: data?.meta?.total ?? 0 })}</p>
        </div>
        <Link to="/products/new">
          <Button icon={<Plus className="h-4 w-4" />}>{t('dashboard.addProduct')}</Button>
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input
            placeholder={t('products.list.searchPlaceholder')}
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={condition} onChange={(e) => setCondition(e.target.value)} className="max-w-[10rem]">
            <option value="">{t('products.list.allConditions')}</option>
            <option value="NEW">{t('status.condition.NEW')}</option>
            <option value="USED">{t('status.condition.USED')}</option>
            <option value="SECOND_HAND">{t('status.condition.SECOND_HAND')}</option>
          </Select>
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : filtered.length ? (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onToggle={(v) => toggle.mutate({ productId: p.id, isAvailable: v })} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    <th className="px-5 py-2.5">{t('table.product')}</th>
                    <th className="px-5 py-2.5">{t('table.price')}</th>
                    <th className="px-5 py-2.5">{t('products.list.condition')}</th>
                    <th className="px-5 py-2.5">{t('table.stock')}</th>
                    <th className="px-5 py-2.5">{t('products.list.variants')}</th>
                    <th className="px-5 py-2.5">{t('products.list.available')}</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-bg-muted">
                      <td className="cursor-pointer px-5 py-3" onClick={() => navigate(`/products/${p.id}`)}>
                        <div className="flex items-center gap-3">
                          {p.imageUrl && !brokenImages.has(p.id) ? (
                            <img
                              src={p.images?.[0] || p.imageUrl}
                              alt=""
                              className="h-10 w-10 rounded-md border border-border object-cover"
                              onError={() => setBrokenImages((prev) => new Set(prev).add(p.id))}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-muted text-text-placeholder">
                              <Boxes className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-text-primary">{p.name}</p>
                            <p className="truncate text-xs text-text-muted">
                              {[p.category?.name, p.subcategory?.name].filter(Boolean).join(' > ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-primary">{formatNaira(p.basePrice)}</td>
                      <td className="px-5 py-3">
                        <ProductConditionBadge condition={p.condition} />
                      </td>
                      <td className="px-5 py-3 text-text-muted">{p.stock}</td>
                      <td className="px-5 py-3">
                        {p.variants.length > 1 ? <Badge tone="brand">{t('products.list.skuCount', { count: p.variants.length })}</Badge> : <span className="text-text-placeholder">-</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Switch checked={p.isAvailable} onChange={(v) => toggle.mutate({ productId: p.id, isAvailable: v })} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/products/${p.id}`} className="inline-flex text-text-muted hover:text-brand">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Boxes}
            title={t('products.list.emptyTitle')}
            subtitle={t('products.list.emptySubtitle')}
            action={
              <Link to="/products/new">
                <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                  {t('dashboard.addProduct')}
                </Button>
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
