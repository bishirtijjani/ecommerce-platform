import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GripVertical, Save, Search, X, Plus, ChevronLeft, RotateCcw } from 'lucide-react';
import { useHomeCategories, useUpdateHomeCategories } from '../../hooks/useHomeCategories';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { useDragReorder } from '../../lib/useDragReorder';
import { cn } from '../../lib/cn';
import type { HomeCategory } from '../../api/home';

const TINTS = ['#EAF3EC', '#EFF6FF', '#ECFDF5', '#F5F3FF', '#FEF3C7', '#FEE2E2'];

const initialOf = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

const tintFor = (c: HomeCategory) => c.color || TINTS[(c.name.charCodeAt(0) || 0) % TINTS.length];

export default function HomeCategoriesPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useHomeCategories();
  const save = useUpdateHomeCategories();

  const [order, setOrder] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);

  // Track each tile's geometry so the pointer drag can pick the nearest slot.
  const tiles = useRef(new Map<string, HTMLElement>());

  const serverOrder = useMemo(
    () => (data ? data.categories.filter((c) => c.featured).map((c) => c.id) : []),
    [data],
  );

  // Seed the working order from the server ONCE (and again after a save), and
  // never while the admin has unsaved edits - otherwise a background refetch
  // would wipe the arrangement they are working on.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const seededRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (seededRef.current && dirtyRef.current) return;
    setOrder(serverOrder);
    seededRef.current = true;
    setDirty(false);
    // Only react to the actual server signature, not to a new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOrder.join('|')]);

  const byId = useMemo(() => {
    const map = new Map<string, HomeCategory>();
    (data?.categories ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [data]);

  const shown = order.map((id) => byId.get(id)).filter((c): c is HomeCategory => !!c);
  const shownSet = useMemo(() => new Set(order), [order]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.categories ?? [])
      .filter((c) => !shownSet.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0) || a.name.localeCompare(b.name));
  }, [data, shownSet, search]);

  const commit = (next: string[]) => {
    setOrder(next);
    setDirty(true);
  };

  const { dragId, registerItem, setDropResolver, startDrag } = useDragReorder(order, commit, { live: true });

  // Nearest-tile resolver: the drop target is the shown tile whose center is
  // closest to the pointer. Registered once so we don't mutate a ref mid-render.
  useEffect(() => {
    setDropResolver((x, y) => {
      let best: string | null = null;
      let bestDist = Infinity;
      tiles.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      });
      return best;
    });
    return () => setDropResolver(null);
  }, [setDropResolver]);

  const show = (id: string) => commit([...order, id]);
  const hide = (id: string) => commit(order.filter((x) => x !== id));
  const resetLayout = () => commit(serverOrder);

  const onSave = () => {
    save.mutate(
      order.map((id) => ({ id, featured: true })),
      { onSuccess: () => setDirty(false) },
    );
  };

  if (isLoading) return <InlineSpinner label="Loading Home categories" />;
  if (error) return <ErrorState title="Could not load Home categories" subtitle="Try refreshing the page." />;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/categories')}
        className="inline-flex items-center gap-1 rounded text-sm font-medium text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <ChevronLeft className="h-4 w-4" />
        Categories
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Home layout</h1>
          <p className="mt-1 text-sm text-text-muted">
            Exactly what shoppers see on the app Home. Drag tiles to reorder, tap ✕ to remove.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />} onClick={resetLayout} disabled={!dirty}>
            Reset
          </Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={onSave} loading={save.isPending} disabled={!dirty}>
            Save{dirty ? ' changes' : ''}
          </Button>
        </div>
      </div>

      {/* WYSIWYG grid - mirrors the app Home categories section */}
      <div className="rounded-lg border border-border bg-bg-surface p-4">
        <div className="flex items-center justify-between px-1 pb-4">
          <span className="text-lg font-black text-text-primary">Categories</span>
          <span className="text-xs font-bold text-text-primary">See all →</span>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No categories yet"
            subtitle="Add some from the list below to build the Home grid."
          />
        ) : (
          <div className="grid grid-cols-4 gap-y-5 gap-x-[4%]">
            {shown.map((c) => {
              const dragging = dragId === c.id;
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    registerItem(c.id)(el);
                    if (el) tiles.current.set(c.id, el);
                    else tiles.current.delete(c.id);
                  }}
                  onPointerDown={startDrag(c.id)}
                  className={cn(
                    'group relative w-full select-none',
                    dragging ? 'z-10 touch-none' : 'touch-pan-y',
                  )}
                >
                  <div
                    className={cn(
                      'relative flex w-full flex-col overflow-hidden rounded-2xl border bg-bg-surface transition-transform',
                      dragging
                        ? 'scale-105 cursor-grabbing border-brand shadow-2xl ring-2 ring-brand/40'
                        : 'cursor-grab border-border',
                    )}
                    style={{ minHeight: 100 }}
                  >
                    <div
                      className="flex h-[56px] items-center justify-center"
                      style={{ backgroundColor: c.imageUrl ? 'transparent' : tintFor(c) }}
                    >
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-full w-full object-contain p-1.5"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xl font-black" style={{ color: c.color || '#0B3D24' }}>
                          {initialOf(c.name)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 items-center justify-center px-1.5 pb-2 pt-1.5">
                      <span className="line-clamp-2 text-center text-[10px] font-extrabold leading-tight text-text-primary">
                        {c.name}
                      </span>
                    </div>

                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white"
                    >
                      <GripVertical className="h-3 w-3" />
                    </span>
                  </div>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => hide(c.id)}
                    aria-label={`Remove ${c.name}`}
                    className="absolute -right-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted shadow-sm transition-colors hover:bg-error hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 px-1 text-xs text-text-muted">
          {shown.length} tile{shown.length === 1 ? '' : 's'} · {Math.ceil(shown.length / 4)} row
          {Math.ceil(shown.length / 4) === 1 ? '' : 's'}
        </div>
      </div>

      {/* Picker */}
      <div className="rounded-lg border border-border bg-bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">Add a category</h2>
          <p className="mt-0.5 text-xs text-text-muted">Tap a category to add it to the Home grid.</p>
          <div className="mt-3">
            <Input
              placeholder="Search categories"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="p-3">
          {available.length === 0 ? (
            <EmptyState icon={Search} title="Nothing to add" subtitle="Every matching category is already on Home." />
          ) : (
            <div className="grid grid-cols-4 gap-x-[4%] gap-y-4">
              {available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => show(c.id)}
                  className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface text-left transition-shadow hover:shadow-md"
                  style={{ minHeight: 100 }}
                >
                  <div
                    className="flex h-[56px] items-center justify-center"
                    style={{ backgroundColor: c.imageUrl ? 'transparent' : tintFor(c) }}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
                    ) : (
                      <span className="text-xl font-black" style={{ color: c.color || '#0B3D24' }}>
                        {initialOf(c.name)}
                      </span>
                    )}
                  </div>
                  <div className="relative flex flex-1 items-center justify-center px-1.5 pb-2 pt-1.5">
                    <span className="line-clamp-2 text-center text-[10px] font-extrabold leading-tight text-text-primary">
                      {c.name}
                    </span>
                    <span className="absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
