import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getHomeCategories,
  updateHomeCategories,
  type HomeCategoriesResult,
  type HomeCategoryItem,
} from '../api/home';
import type { ApiError } from '../api/client';

const KEY = ['admin', 'home-categories'];

export const useHomeCategories = () =>
  useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => getHomeCategories(signal),
  });

export const useUpdateHomeCategories = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: HomeCategoryItem[]) => updateHomeCategories(items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<HomeCategoriesResult>(KEY);
      if (previous) {
        const featuredIds = items.filter((i) => i.featured).map((i) => i.id);
        const featuredSet = new Set(featuredIds);
        const position = new Map(featuredIds.map((id, index) => [id, index]));
        const categories = previous.categories
          .map((c) => ({
            ...c,
            featured: featuredSet.has(c.id),
            homePosition: position.has(c.id) ? (position.get(c.id) as number) : null,
          }))
          .sort((a, b) => {
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            if (a.featured && b.featured) return (a.homePosition ?? 0) - (b.homePosition ?? 0);
            return 0;
          });
        qc.setQueryData<HomeCategoriesResult>(KEY, { categories, featuredIds });
      }
      return { previous };
    },
    onError: (err: ApiError, _items, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(err.message);
    },
    onSuccess: () => toast.success('Home categories saved'),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
