import { useMemo, useState } from 'react';
import { Tag, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../../hooks/useTags';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ColorField } from '../../components/ui/ColorField';
import { EmojiField } from '../../components/ui/EmojiField';
import { Switch } from '../../components/ui/Switch';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';
import { isValidHex } from '../../lib/validation';
import type { Tag as TagType } from '../../types';

interface TagFormData {
  name: string;
  category: string;
  color: string;
  icon: string;
}

const emptyForm: TagFormData = { name: '', category: '', color: '', icon: '' };

interface FormErrors {
  name?: string;
  color?: string;
  icon?: string;
}

const validate = (form: TagFormData): FormErrors => {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (form.color && !isValidHex(form.color)) errors.color = 'Enter a valid hex color like #0B3D24';
  if (form.icon && form.icon.length > 10) errors.icon = 'Icon must be a single emoji or short symbol';
  return errors;
};

export default function TagsList() {
  const { data, isLoading, error } = useTags({ limit: 100 });
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TagType | null>(null);
  const [form, setForm] = useState<TagFormData>(emptyForm);
  const [touched, setTouched] = useState<Record<keyof TagFormData, boolean>>({
    name: false,
    category: false,
    color: false,
    icon: false,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setTouched({ name: false, category: false, color: false, icon: false });
    setFormOpen(true);
  };

  const openEdit = (tag: TagType) => {
    setEditing(tag);
    setForm({
      name: tag.name,
      category: tag.category || '',
      color: tag.color || '',
      icon: tag.icon || '',
    });
    setTouched({ name: false, category: false, color: false, icon: false });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setTouched({ name: false, category: false, color: false, icon: false });
  };

  const updateField = (field: keyof TagFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = () => {
    setTouched({ name: true, category: true, color: true, icon: true });
    if (Object.keys(validate(form)).length > 0) return;
    const payload = {
      name: form.name,
      category: form.category || undefined,
      color: form.color || undefined,
      icon: form.icon || undefined,
    };
    if (editing) {
      update.mutate({ id: editing.id, data: payload }, { onSuccess: closeForm });
    } else {
      create.mutate(payload, { onSuccess: closeForm });
    }
  };

  const toggleActive = (tag: TagType) => {
    update.mutate({ id: tag.id, data: { isActive: !tag.isActive } });
  };

  const filtered = data?.data?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Tags</h1>
          <p className="text-sm text-text-muted">Manage global vendor tags.</p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Add tag</Button>
      </div>

      <Card>
        <CardBody>
          <Input placeholder="Search tags..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !filtered.length ? (
        <EmptyState icon={Tag} title="No tags found" subtitle={search ? 'Try a different search.' : 'Add your first tag to get started.'} action={<Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>Add tag</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tag) => (
            <Card key={tag.id} className={cn('transition-shadow hover:shadow-popover', !tag.isActive && 'bg-bg-muted/40 border-border-muted')}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-md text-white"
                      style={{ backgroundColor: tag.color || 'rgb(var(--brand-default))' }}
                    >
                      {tag.icon ? <span className="text-lg">{tag.icon}</span> : <Tag className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-semibold', tag.isActive ? 'text-text-primary' : 'text-text-muted')}>{tag.name}</p>
                      <p className="text-xs text-text-muted">{tag.category || 'General'} · {tag._count?.vendors ?? 0} vendors</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(tag)} aria-label="Edit tag"><Pencil className="h-4 w-4 text-text-muted" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(tag.id)} aria-label="Delete tag"><Trash2 className="h-4 w-4 text-error" /></Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className={cn('text-xs font-medium', tag.isActive ? 'text-success-strong' : 'text-text-muted')}>
                    {tag.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch checked={tag.isActive} onChange={() => toggleActive(tag)} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit tag' : 'Add tag'}
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={create.isPending || update.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} loading={create.isPending || update.isPending} disabled={hasErrors}>
              {editing ? 'Save changes' : 'Create tag'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            error={touched.name ? errors.name : undefined}
          />
          <Input label="Category" value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="e.g. Features" />
          <div className="grid gap-4 sm:grid-cols-2">
            <EmojiField
              label="Icon"
              value={form.icon}
              onChange={(value) => updateField('icon', value)}
              placeholder="✅"
              error={touched.icon ? errors.icon : undefined}
            />
            <ColorField
              label="Accent color"
              value={form.color}
              onChange={(value) => updateField('color', value)}
              error={touched.color ? errors.color : undefined}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })}
        title="Delete tag?"
        description="This will permanently remove the tag."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  );
}
