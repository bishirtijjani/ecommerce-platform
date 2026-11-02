import { useMemo, useState } from 'react';
import { Plus, X, Package, Ruler, Palette } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Switch } from './Switch';
import { cn } from '../../lib/cn';
import type { CategoryAttributeSchema, PackUnit } from '../../types';

const PACK_UNITS: { value: PackUnit; label: string }[] = [
  { value: 'ML', label: 'Millilitre' },
  { value: 'L', label: 'Litre' },
  { value: 'G', label: 'Gram' },
  { value: 'KG', label: 'Kilogram' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'PIECE', label: 'Piece' },
  { value: 'PAIR', label: 'Pair' },
  { value: 'PACK', label: 'Pack' },
  { value: 'BOTTLE', label: 'Bottle' },
  { value: 'SACHET', label: 'Sachet' },
  { value: 'CARTON', label: 'Carton' },
];

const PRESET_AXES = ['Size', 'Color', 'Material', 'Strength', 'Flavor', 'Weight', 'Dimension'];

interface AttributeSchemaBuilderProps {
  open: boolean;
  onClose: () => void;
  categoryName: string;
  schema: CategoryAttributeSchema | null;
  onSave: (schema: CategoryAttributeSchema | null) => void;
  loading?: boolean;
}

export const AttributeSchemaBuilder = ({
  open,
  onClose,
  categoryName,
  schema,
  onSave,
  loading,
}: AttributeSchemaBuilderProps) => {
  const [axes, setAxes] = useState<string[]>(schema?.axes ?? []);
  const [pack, setPack] = useState(schema?.pack ?? false);
  const [packUnits, setPackUnits] = useState<PackUnit[]>(schema?.packUnits ?? []);
  const [sizeSystem, setSizeSystem] = useState(schema?.sizeSystem ?? '');

  const hasChanges = useMemo(() => {
    const normalize = (v: CategoryAttributeSchema | null) =>
      JSON.stringify({ axes: v?.axes ?? [], pack: v?.pack ?? false, packUnits: v?.packUnits ?? [], sizeSystem: v?.sizeSystem ?? '' });
    return normalize(schema) !== normalize({ axes, pack, packUnits: pack ? packUnits : [], sizeSystem });
  }, [axes, pack, packUnits, schema, sizeSystem]);

  const toggleUnit = (unit: PackUnit) => {
    setPackUnits((prev) => (prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]));
  };

  const addAxis = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || axes.includes(trimmed)) return;
    setAxes((prev) => [...prev, trimmed]);
  };

  const removeAxis = (idx: number) => {
    setAxes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const next: CategoryAttributeSchema = {};
    if (axes.length) next.axes = axes;
    if (pack) {
      next.pack = true;
      if (packUnits.length) next.packUnits = packUnits;
    }
    if (sizeSystem.trim()) next.sizeSystem = sizeSystem.trim();
    onSave(Object.keys(next).length ? next : null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Attribute schema: ${categoryName}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading} disabled={!hasChanges}>
            Save schema
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-text-muted">
          Define the product-variant dimensions and packaging options vendors can use for this category.
        </p>

        {/* Axes */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Variant axes</h3>
          </div>
          <p className="text-xs text-text-muted">E.g. Size, Color, Strength. Up to 10 axes.</p>

          <div className="flex flex-wrap gap-2">
            {axes.map((axis, idx) => (
              <span
                key={`${axis}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong"
              >
                {axis}
                <button
                  onClick={() => removeAxis(idx)}
                  className="rounded-full p-0.5 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                  aria-label={`Remove ${axis}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_AXES.filter((p) => !axes.includes(p)).map((preset) => (
              <button
                key={preset}
                onClick={() => addAxis(preset)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <Plus className="h-3 w-3" /> {preset}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('newAxis') as HTMLInputElement;
              addAxis(input.value);
              input.value = '';
            }}
            className="flex gap-2"
          >
            <Input name="newAxis" placeholder="Add custom axis..." className="flex-1" />
            <Button type="submit" icon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          </form>
        </section>

        {/* Packaging */}
        <section className="space-y-3 rounded-lg border border-border bg-bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary">Packaging</h3>
            </div>
            <Switch checked={pack} onChange={setPack} label="Enable packaging" />
          </div>

          {pack && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">Select allowed pack units for this category.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PACK_UNITS.map((unit) => (
                  <label
                    key={unit.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      packUnits.includes(unit.value)
                        ? 'border-brand bg-brand-soft text-brand-strong'
                        : 'border-border bg-bg-surface text-text-primary hover:bg-bg-muted',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      checked={packUnits.includes(unit.value)}
                      onChange={() => toggleUnit(unit.value)}
                    />
                    {unit.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Size system */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Size system</h3>
          </div>
          <Input
            value={sizeSystem}
            onChange={(e) => setSizeSystem(e.target.value)}
            placeholder="e.g. US, UK, EU, Numeric"
            hint="Optional label for how sizes are measured in this category."
          />
        </section>
      </div>
    </Modal>
  );
};
