import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { HighlightCard } from '../../components/HighlightCard';
import { useHighlights } from '../../hooks/useHighlights';
import { useVendorProducts } from '../../hooks/useProducts';
import { useAuthStore } from '../../store/authStore';
import type { Highlight, HighlightInput, StoryInput } from '../../types';

export default function Highlights() {
  const { t } = useTranslation();
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const {
    highlights,
    isLoading,
    addHighlight,
    editHighlight,
    removeHighlight,
    addStory,
    editStory,
    removeStory,
    moveStory,
  } = useHighlights(vendorId);

  // The vendor's catalogue, for linking products to stories (up to 2 per story).
  const { data: productPage } = useVendorProducts({ limit: 100 });
  const productOptions = (productPage?.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    price: Number(p.basePrice),
    description: p.description,
  }));

  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    addHighlight.mutate({ name: newName.trim() } as HighlightInput);
    setNewName('');
  };

  const working = addHighlight.isPending || editHighlight.isPending || removeHighlight.isPending
    || addStory.isPending || editStory.isPending || removeStory.isPending || moveStory.isPending;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-text-primary">{t('nav.highlights')}</h1>
        <Card>
          <CardBody>
            <p className="text-sm text-text-muted">{t('highlights.loading')}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">{t('nav.highlights')}</h1>
          <span className="text-sm text-text-muted">
            {t('highlights.collectionCount', { count: highlights.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('highlights.newPlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-52"
          />
          <Button onClick={handleCreate} loading={addHighlight.isPending} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      <p className="text-sm text-text-muted">
        {t('highlights.description')}
      </p>

      {highlights.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <span className="text-3xl" role="img" aria-label={t('highlights.photo')}>
              📷
            </span>
            <p className="mt-2 text-sm text-text-muted">
              {t('highlights.empty')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {highlights.map((h: Highlight) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              products={productOptions}
              updating={working}
              onUpdate={(patch) => editHighlight.mutate({ highlightId: h.id, input: patch })}
              onDelete={() => removeHighlight.mutate(h.id)}
              onAddStory={(input: StoryInput) => addStory.mutate({ highlightId: h.id, input })}
              onUpdateStory={(storyId, input) =>
                editStory.mutate({ highlightId: h.id, storyId, input })
              }
              onDeleteStory={(storyId) => removeStory.mutate({ highlightId: h.id, storyId })}
              onReorderStories={(storyIds: string[]) =>
                moveStory.mutate({ highlightId: h.id, storyIds })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
