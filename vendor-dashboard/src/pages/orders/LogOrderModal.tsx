import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, UserRound, MapPin, Check } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { searchCustomers } from '../../api/vendor';
import { useVendorProducts } from '../../hooks/useProducts';
import { useLogOrder } from '../../hooks/useOrders';
import { useAuthStore } from '../../store/authStore';
import { formatNaira } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { SavedAddress, VendorCustomer, Product, ProductVariant } from '../../types';

interface LineItem {
  key: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export const LogOrderModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<VendorCustomer | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const logOrder = useLogOrder();

  const { data: matches, isFetching: searching } = useQuery({
    queryKey: ['customer-search', vendorId, phone],
    queryFn: () => searchCustomers(vendorId, phone),
    enabled: phone.replace(/\D/g, '').length >= 6 && !customer,
  });

  const { data: productsPage } = useVendorProducts();
  const products = useMemo(() => {
    const all = productsPage?.data.filter((p) => p.isAvailable) || [];
    if (!productQuery.trim()) return all.slice(0, 8);
    const q = productQuery.toLowerCase();
    return all.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [productsPage, productQuery]);

  const addItem = (product: Product, variant: ProductVariant) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) return prev.map((i) => (i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { key: variant.id, product, variant, quantity: 1 }];
    });
  };

  const setQty = (variantId: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.variant.id === variantId ? { ...i, quantity: Math.max(1, qty) } : i)).filter((i) => i.quantity > 0));
  };

  const removeItem = (variantId: string) => setItems((prev) => prev.filter((i) => i.variant.id !== variantId));

  const total = items.reduce((sum, i) => sum + i.variant.price * i.quantity, 0);

  const reset = () => {
    setPhone('');
    setCustomer(null);
    setAddressId(null);
    setNewAddress('');
    setProductQuery('');
    setItems([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit = customer && (addressId || newAddress.trim().length >= 5) && items.length > 0;

  const handleSubmit = () => {
    if (!customer || !canSubmit) return;
    logOrder.mutate(
      {
        customerId: customer.id,
        ...(addressId ? { shippingAddressId: addressId } : { newAddress: { address: newAddress.trim() } }),
        items: items.map((i) => ({ productId: i.product.id, variantId: i.variant.id, quantity: i.quantity })),
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('dashboard.logOrder')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={logOrder.isPending}>
            {t('orders.logOrderButton')} {items.length > 0 && `· ${formatNaira(total)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Step 1: customer */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <UserRound className="h-3.5 w-3.5" /> {t('table.customer')}
          </p>
          {customer ? (
            <div className="flex items-center justify-between rounded-md border border-brand-softBorder bg-brand-soft px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <Avatar name={`${customer.firstName} ${customer.lastName}`} size={32} />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-xs text-text-muted">{customer.phone}</p>
                </div>
              </div>
              <button
                className="text-xs font-medium text-text-muted hover:text-text-primary"
                onClick={() => {
                  setCustomer(null);
                  setAddressId(null);
                }}
              >
                {t('orders.customer.change')}
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder={t('orders.customer.searchPlaceholder')}
                leftIcon={<Search className="h-4 w-4" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                rightSlot={searching ? <Spinner className="h-4 w-4" /> : undefined}
              />
              {phone.replace(/\D/g, '').length >= 6 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                  {matches?.length ? (
                    matches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setCustomer(m)}
                        className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-bg-muted"
                      >
                        <Avatar name={`${m.firstName} ${m.lastName}`} size={28} />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {m.firstName} {m.lastName}
                          </p>
                          <p className="text-xs text-text-muted">{m.phone}</p>
                        </div>
                      </button>
                    ))
                  ) : !searching ? (
                    <p className="px-3 py-3 text-xs text-text-muted">
                      {t('orders.customer.noAccount')}
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </section>

        {/* Step 2: address */}
        {customer && (
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <MapPin className="h-3.5 w-3.5" /> {t('orders.address.title')}
            </p>
            <div className="space-y-2">
              {customer.savedAddresses.map((addr: SavedAddress) => (
                <button
                  key={addr.id}
                  onClick={() => {
                    setAddressId(addr.id);
                    setNewAddress('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3.5 py-2.5 text-left text-sm',
                    addressId === addr.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-bg-muted',
                  )}
                >
                  <div>
                    <span className="font-medium text-text-primary">{addr.label}</span>
                    <span className="ml-2 text-text-muted">{addr.address}</span>
                  </div>
                  {addressId === addr.id && <Check className="h-4 w-4 text-brand" />}
                </button>
              ))}
              <Textarea
                placeholder={t('orders.address.newPlaceholder')}
                value={newAddress}
                onChange={(e) => {
                  setNewAddress(e.target.value);
                  if (e.target.value) setAddressId(null);
                }}
                className="min-h-[52px]"
              />
            </div>
          </section>
        )}

        {/* Step 3: items */}
        {customer && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('table.items')}</p>
            <Input
              placeholder={t('orders.items.searchPlaceholder')}
              leftIcon={<Search className="h-4 w-4" />}
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {products.map((p) =>
                p.variants.map((v) => {
                  const attrs = v.attributes && Object.keys(v.attributes).length > 0
                    ? Object.values(v.attributes).join(', ')
                    : null;
                  return (
                    <button
                      key={v.id}
                      onClick={() => addItem(p, v)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-muted"
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-bg-muted">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg text-text-placeholder">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                        <p className="truncate text-xs text-text-muted">
                          {attrs ? attrs : p.description ? p.description : ''}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-success">{formatNaira(v.price)}</p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-text-muted" />
                    </button>
                  );
                }),
              )}
              {!products.length && <p className="px-3 py-3 text-xs text-text-muted">{t('orders.items.noMatches')}</p>}
            </div>

            {items.length > 0 && (
              <div className="mt-3 space-y-2">
                {items.map((i) => (
                  <div key={i.key} className="flex items-center justify-between gap-2 rounded-md bg-bg-muted px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{i.product.name}</p>
                      <p className="text-xs text-text-muted">{t('orders.items.each', { price: formatNaira(i.variant.price) })}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(i.variant.id, i.quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded bg-bg-surface hover:bg-bg-strong">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => setQty(i.variant.id, i.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded bg-bg-surface hover:bg-bg-strong">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-16 shrink-0 text-right text-sm font-medium text-text-primary sm:w-20">{formatNaira(i.variant.price * i.quantity)}</p>
                    <button onClick={() => removeItem(i.variant.id)} className="flex h-9 w-9 items-center justify-center text-text-muted hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-text-primary">
                  <span>{t('table.total')}</span>
                  <span>{formatNaira(total)}</span>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
};
