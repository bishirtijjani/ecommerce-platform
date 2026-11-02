import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import type { SelectionRule } from '../../types';

export interface OptionItemDraft {
  key: string;
  id?: string;
  name: string;
  priceDelta: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface OptionGroupDraft {
  key: string;
  id?: string;
  name: string;
  selectionRule: SelectionRule;
  maxSelect: number;
  items: OptionItemDraft[];
}

const RULE_LABEL_KEY: Record<SelectionRule, string> = {
  REQUIRED_ONE: 'products.options.rules.REQUIRED_ONE',
  OPTIONAL_ONE: 'products.options.rules.OPTIONAL_ONE',
  REQUIRED_MULTIPLE: 'products.options.rules.REQUIRED_MULTIPLE',
  OPTIONAL_MULTIPLE: 'products.options.rules.OPTIONAL_MULTIPLE',
};

const ruleDefaults = (rule: SelectionRule): { minSelect: number; maxSelect: number } => {
  switch (rule) {
    case 'REQUIRED_ONE':
      return { minSelect: 1, maxSelect: 1 };
    case 'OPTIONAL_ONE':
      return { minSelect: 0, maxSelect: 1 };
    case 'REQUIRED_MULTIPLE':
      return { minSelect: 1, maxSelect: 2 };
    default:
      return { minSelect: 0, maxSelect: 2 };
  }
};

export const emptyGroup = (): OptionGroupDraft => ({
  key: crypto.randomUUID(),
  name: '',
  selectionRule: 'OPTIONAL_ONE',
  maxSelect: 1,
  items: [],
});

const emptyItem = (): OptionItemDraft => ({ key: crypto.randomUUID(), name: '', priceDelta: '0', isDefault: false, isAvailable: true });

export const buildOptionGroupsPayload = (groups: OptionGroupDraft[]) =>
  groups
    .filter((g) => g.name.trim())
    .map((g) => ({
      ...(g.id && { id: g.id }),
      name: g.name.trim(),
      selectionRule: g.selectionRule,
      minSelect: ruleDefaults(g.selectionRule).minSelect,
      maxSelect: g.selectionRule.includes('MULTIPLE') ? g.maxSelect : ruleDefaults(g.selectionRule).maxSelect,
      items: g.items
        .filter((i) => i.name.trim())
        .map((i) => ({
          ...(i.id && { id: i.id }),
          name: i.name.trim(),
          priceDelta: Number(i.priceDelta) || 0,
          isDefault: i.isDefault,
          isAvailable: i.isAvailable,
        })),
    }));

const GroupCard = ({ group, onChange, onRemove }: { group: OptionGroupDraft; onChange: (g: OptionGroupDraft) => void; onRemove: () => void }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const updateItem = (key: string, patch: Partial<OptionItemDraft>) =>
    onChange({ ...group, items: group.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  const removeItem = (key: string) => onChange({ ...group, items: group.items.filter((i) => i.key !== key) });

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-text-muted">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <Input placeholder={t('products.options.groupNamePlaceholder')} value={group.name} onChange={(e) => onChange({ ...group, name: e.target.value })} className="flex-1" />
        <button type="button" onClick={onRemove} className="text-text-muted hover:text-error">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              label={t('products.options.selectionRule')}
              value={group.selectionRule}
              onChange={(e) => onChange({ ...group, selectionRule: e.target.value as SelectionRule, maxSelect: ruleDefaults(e.target.value as SelectionRule).maxSelect })}
            >
              {(Object.keys(RULE_LABEL_KEY) as SelectionRule[]).map((r) => (
                <option key={r} value={r}>
                  {t(RULE_LABEL_KEY[r])}
                </option>
              ))}
            </Select>
            {group.selectionRule.includes('MULTIPLE') && (
              <Input
                label={t('products.options.maxPicks')}
                type="number"
                min={1}
                value={group.maxSelect}
                onChange={(e) => onChange({ ...group, maxSelect: Number(e.target.value) || 1 })}
              />
            )}
          </div>

          <div className="space-y-2">
            {group.items.map((item) => (
              <div key={item.key} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                <Input
                  placeholder={t('products.options.optionName')}
                  value={item.name}
                  onChange={(e) => updateItem(item.key, { name: e.target.value })}
                  className="sm:col-span-6"
                />
                <Input
                  placeholder={t('products.options.priceDelta')}
                  type="number"
                  value={item.priceDelta}
                  onChange={(e) => updateItem(item.key, { priceDelta: e.target.value })}
                  className="sm:col-span-3"
                />
                <div className="flex items-center gap-1.5 sm:col-span-2">
                  <Switch checked={item.isAvailable} onChange={(v) => updateItem(item.key, { isAvailable: v })} label={t('products.list.available')} />
                  <span className="text-xs text-text-muted">{t('products.list.available')}</span>
                </div>
                <button type="button" onClick={() => removeItem(item.key)} className="justify-self-end text-text-muted hover:text-error sm:col-span-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange({ ...group, items: [...group.items, emptyItem()] })}>
              {t('products.options.addOption')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const OptionGroupsEditor = ({ groups, onChange }: { groups: OptionGroupDraft[]; onChange: (g: OptionGroupDraft[]) => void }) => {
  const { t } = useTranslation();
  const update = (key: string, g: OptionGroupDraft) => onChange(groups.map((x) => (x.key === key ? g : x)));
  const remove = (key: string) => onChange(groups.filter((x) => x.key !== key));

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {t('products.options.hint')}
      </p>
      {groups.map((g) => (
        <GroupCard key={g.key} group={g} onChange={(ng) => update(g.key, ng)} onRemove={() => remove(g.key)} />
      ))}
      <Button type="button" variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...groups, emptyGroup()])}>
        {t('products.options.addGroup')}
      </Button>
    </div>
  );
};
