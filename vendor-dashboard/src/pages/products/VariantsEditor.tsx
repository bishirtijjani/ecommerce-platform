import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';

export interface VariantDraft {
  key: string;
  id?: string;
  attributesText: string; // "size: M, color: Black"
  price: string;
  stock: string;
  isAvailable: boolean;
}

export const emptyVariant = (): VariantDraft => ({
  key: crypto.randomUUID(),
  attributesText: '',
  price: '',
  stock: '0',
  isAvailable: true,
});

export const parseAttributes = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [k, ...rest] = pair.split(':');
      if (k && rest.length) out[k.trim()] = rest.join(':').trim();
    });
  return out;
};

export const VariantsEditor = ({ variants, onChange }: { variants: VariantDraft[]; onChange: (v: VariantDraft[]) => void }) => {
  const { t } = useTranslation();
  const update = (key: string, patch: Partial<VariantDraft>) =>
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const remove = (key: string) => onChange(variants.filter((v) => v.key !== key));

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {t('products.variants.hint')}
      </p>
      {variants.map((v) => (
        <div key={v.key} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-5">
            <Input
              label={t('products.variants.attributes')}
              placeholder={t('products.variants.attributesPlaceholder')}
              value={v.attributesText}
              onChange={(e) => update(v.key, { attributesText: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <Input label={t('products.variants.price')} type="number" min={0} value={v.price} onChange={(e) => update(v.key, { price: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Input label={t('table.stock')} type="number" min={0} value={v.stock} onChange={(e) => update(v.key, { stock: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-1">
            <Switch checked={v.isAvailable} onChange={(val) => update(v.key, { isAvailable: val })} label={t('products.list.available')} />
          </div>
          <div className="flex justify-end sm:col-span-1">
            <button onClick={() => remove(v.key)} className="text-text-muted hover:text-error">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...variants, emptyVariant()])}>
        {t('products.variants.add')}
      </Button>
    </div>
  );
};
