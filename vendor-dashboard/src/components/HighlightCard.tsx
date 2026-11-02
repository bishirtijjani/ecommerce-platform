import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, MoveUp, MoveDown, X, Plus, Link2, Play } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import { Input, Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ImageUpload } from './ImageUpload';
import { ProductPicker } from './ProductPicker';
import type { Highlight, StoryInput } from '../types';

export interface HighlightPatch {
  name?: string;
  coverImageUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface HighlightProductOption {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  description?: string | null;
}

export interface HighlightCardProps {
  highlight: Highlight;
  products: HighlightProductOption[];
  onUpdate: (patch: HighlightPatch) => void;
  onDelete: () => void;
  onAddStory: (input: StoryInput) => void;
  onUpdateStory: (storyId: string, input: Partial<StoryInput>) => void;
  onDeleteStory: (storyId: string) => void;
  onReorderStories: (storyIds: string[]) => void;
  updating: boolean;
}

interface InlineInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}

const InlineInput = ({ label, value, onChange, onBlur, disabled }: InlineInputProps) => (
  <Input
    label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onBlur}
    disabled={disabled}
  />
);

const StoryVideo = ({ src }: { src: string }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="group relative block h-full w-full overflow-hidden rounded-md bg-black"
      aria-label={playing && !paused ? t('highlights.pauseVideo') : t('highlights.playVideo')}
    >
      <video
        ref={ref}
        src={src}
        className="h-full w-full object-cover"
        preload="metadata"
        playsInline
        muted
        loop
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      {(!playing || paused) && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black transition-transform group-hover:scale-110">
            <Play className="ml-0.5 h-4 w-4" />
          </span>
        </span>
      )}
    </button>
  );
};

export const HighlightCard = ({
  highlight,
  products,
  onUpdate,
  onDelete,
  onAddStory,
  onUpdateStory,
  onDeleteStory,
  onReorderStories,
  updating,
}: HighlightCardProps) => {
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState(highlight.name);
  const [draftCover, setDraftCover] = useState(highlight.coverImageUrl);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<'image' | 'video'>('image');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftProductId, setDraftProductId] = useState('');
  const [draftProductId2, setDraftProductId2] = useState('');
  // 'highlight' = delete the whole highlight card; otherwise a story id.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== highlight.name) onUpdate({ name: trimmed });
  };
  const commitCover = (url: string | null) => {
    setDraftCover(url);
    onUpdate({ coverImageUrl: url || null });
  };
  const commitStoryCaption = (storyId: string, value: string) => {
    onUpdateStory(storyId, { caption: value });
  };

  const toggleDraftProduct = (id: string) => {
    const first = draftProductId;
    const second = draftProductId2;
    if (first === id) {
      setDraftProductId(second);
      setDraftProductId2('');
    } else if (second === id) {
      setDraftProductId2('');
    } else if (!first) {
      setDraftProductId(id);
    } else if (!second) {
      setDraftProductId2(id);
    }
  };

  const saveStory = () => {
    if (!pendingUrl) return;
    const productIds = [draftProductId, draftProductId2].filter(Boolean).slice(0, 2);
    onAddStory({ mediaUrl: pendingUrl, mediaType: pendingType, caption: draftCaption.trim() || null, productIds });
    setPendingUrl(null);
    setPendingType('image');
    setDraftCaption('');
    setDraftProductId('');
    setDraftProductId2('');
  };

  const toggleStoryProduct = (storyId: string, productId: string) => {
    const story = highlight.stories.find((s) => s.id === storyId);
    if (!story) return;
    const existing = story.products.map((p) => p.id);
    if (existing.includes(productId)) {
      onUpdateStory(storyId, { productIds: existing.filter((id) => id !== productId) });
    } else if (existing.length < 2) {
      onUpdateStory(storyId, { productIds: [...existing, productId] });
    }
  };

  const detachProduct = (storyId: string, productId: string) => {
    const story = highlight.stories.find((s) => s.id === storyId);
    if (!story) return;
    onUpdateStory(storyId, { productIds: story.products.filter((p) => p.id !== productId).map((p) => p.id) });
  };

  const moveStory = (fromIdx: number, toIdx: number) => {
    const stories = highlight.stories;
    const next = [...stories];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorderStories(next.map((s) => s.id));
  };
  const cancelPending = () => {
    setPendingUrl(null);
    setPendingType('image');
    setDraftCaption('');
    setDraftProductId('');
    setDraftProductId2('');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{draftName || t('highlights.untitled')}</CardTitle>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${highlight.isActive ? 'text-success' : 'text-text-muted'}`}>
                {highlight.isActive ? t('highlights.live') : t('highlights.hidden')}
              </span>
              <Switch
                checked={highlight.isActive}
                onChange={(v) => onUpdate({ isActive: v })}
              />
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete('highlight')} title={t('highlights.deleteHighlight')}>
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InlineInput
              label={t('highlights.nameLabel')}
              value={draftName}
              onChange={setDraftName}
              onBlur={commitName}
              disabled={updating}
            />
            <ImageUpload
              label={t('products.form.coverImage')}
              value={draftCover || null}
              onChange={(url) => commitCover(url)}
              kind="highlight"
              aspect="wide"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">
                {t('highlights.storiesCount', { count: highlight.stories.length })}
              </p>
              <Button size="sm" variant="outline" onClick={() => setPendingUrl('')}>
              <Plus className="h-4 w-4" /> {t('highlights.addStory')}
            </Button>
          </div>

          {pendingUrl !== null && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <ImageUpload
                label={t('highlights.storyMedia')}
                value={pendingUrl || null}
                mediaType={pendingType}
                onChange={(url, type) => {
                  setPendingUrl(url);
                  setPendingType(type);
                }}
                kind="highlight"
                aspect="square"
                acceptVideo
                containerClassName="w-full sm:w-40"
              />
              <Textarea
                label={t('highlights.captionOptional')}
                value={draftCaption}
                onChange={(e) => setDraftCaption(e.target.value)}
                placeholder={t('highlights.captionPlaceholder')}
              />
              <div>
                <p className="mb-1.5 text-sm font-medium text-text-primary">
                  {t('highlights.linkProducts')}
                </p>
                <ProductPicker
                  products={products}
                  selectedIds={[draftProductId, draftProductId2].filter(Boolean)}
                  max={2}
                  maxReached={!!draftProductId && !!draftProductId2}
                  onSelect={toggleDraftProduct}
                  triggerLabel={t('highlights.addProduct')}
                  searchPlaceholder={t('highlights.searchProducts')}
                  maxHeight="max-h-48"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <Button size="sm" variant="outline" onClick={cancelPending} className="w-full sm:w-auto">
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={saveStory} disabled={!pendingUrl || !pendingUrl.trim()} className="w-full sm:w-auto">
                  {t('highlights.saveStory')}
                </Button>
              </div>
            </div>
          )}

          {highlight.stories.length === 0 ? (
            <p className="text-sm text-text-muted">{t('highlights.noStories')}</p>
          ) : (
            <div className="space-y-3">
              {highlight.stories.map((s, idx) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-bg-surface p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    {/* Media thumbnail - larger; on mobile it sits on top, on
                        desktop it sits to the left of the content */}
                    <div className="relative h-32 w-32 shrink-0 self-center overflow-hidden rounded-md bg-bg-muted sm:h-24 sm:w-24 sm:self-start">
                      {s.mediaType === 'video' ? (
                        <StoryVideo src={s.mediaUrl} />
                      ) : (
                        <img
                          src={s.mediaUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <Textarea
                        label={t('highlights.captionLabel')}
                        defaultValue={s.caption || ''}
                        onBlur={(e) => commitStoryCaption(s.id, e.target.value)}
                        placeholder={t('highlights.captionEmptyPlaceholder')}
                      />
                      {/* Linked products (up to 2) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {s.products.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-muted px-2.5 py-1 text-xs text-text-primary"
                          >
                            <Link2 className="h-3 w-3" />
                            {p.name}
                            <button
                              type="button"
                              onClick={() => detachProduct(s.id, p.id)}
                              className="rounded-full p-0.5 text-text-muted transition-colors hover:bg-bg-strong hover:text-error"
                              aria-label={t('highlights.removeProduct', { name: p.name })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {s.products.length < 2 && (
                          <ProductPicker
                            products={products}
                            selectedIds={s.products.map((sp) => sp.id)}
                            max={2}
                            maxReached={s.products.length >= 2}
                            onSelect={(id) => toggleStoryProduct(s.id, id)}
                            triggerLabel={t('highlights.linkProduct')}
                            searchPlaceholder={t('highlights.searchProducts')}
                            maxHeight="max-h-44"
                            inline
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Story toolbar - clearly separated below the content */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 sm:mt-4">
                    <span className="text-sm font-medium text-text-muted">
                      {t('highlights.storyLabel', { number: idx + 1 })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 !px-0"
                        onClick={() => moveStory(idx, idx - 1)}
                        disabled={idx === 0}
                        title={t('highlights.moveUp')}
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 !px-0"
                        onClick={() => moveStory(idx, idx + 1)}
                        disabled={idx === highlight.stories.length - 1}
                        title={t('highlights.moveDown')}
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 !px-0"
                        onClick={() => setConfirmDelete(s.id)}
                        title={t('highlights.deleteStory')}
                      >
                        <X className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
    <ConfirmDialog
      open={confirmDelete !== null}
      onClose={() => setConfirmDelete(null)}
      onConfirm={() => {
        if (confirmDelete === 'highlight') onDelete();
        else if (confirmDelete) onDeleteStory(confirmDelete);
        setConfirmDelete(null);
      }}
      title={confirmDelete === 'highlight' ? t('highlights.confirmDeleteHighlightTitle') : t('highlights.confirmDeleteStoryTitle')}
      description={confirmDelete === 'highlight'
        ? t('highlights.confirmDeleteHighlightBody')
        : t('highlights.confirmDeleteStoryBody')}
      confirmLabel={confirmDelete === 'highlight' ? t('highlights.confirmDeleteHighlightConfirm') : t('highlights.confirmDeleteStoryConfirm')}
      danger
    />
    </>
  );
};
