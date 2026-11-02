import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Boxes, Pencil } from 'lucide-react';
import { Badge, ProductConditionBadge } from '../../components/ui/Badge';
import { Switch } from '../../components/ui/Switch';
import { formatNaira } from '../../lib/format';
import type { Product } from '../../types';

export const ProductCard = ({ product, onToggle }: { product: Product; onToggle: (isAvailable: boolean) => void }) => {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0">
      <Link to={`/products/${product.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        {product.imageUrl && !broken ? (
          <img src={product.images?.[0] || product.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md border border-border object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg-muted text-text-placeholder">
            <Boxes className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{product.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
            <span>{formatNaira(product.basePrice)}</span>
            <ProductConditionBadge condition={product.condition} />
            {product.variants.length > 1 && <Badge tone="brand">{t('products.list.skuCount', { count: product.variants.length })}</Badge>}
          </div>
        </div>
      </Link>
      <Switch checked={product.isAvailable} onChange={onToggle} />
      <Link to={`/products/${product.id}`} className="flex h-9 w-9 items-center justify-center text-text-muted">
        <Pencil className="h-4 w-4" />
      </Link>
    </div>
  );
};
