import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  getVendorHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  createStory,
  updateStory,
  deleteStory,
  reorderStories,
} from '../api/vendor';
import { useAuthStore } from '../store/authStore';
import type { Highlight, HighlightInput, StoryInput } from '../types';

export const HIGHLIGHTS_QUERY_KEY = ['vendor-highlights'];

export const useHighlights = (vendorId?: string) => {
  const qc = useQueryClient();
  const id = vendorId ?? (useAuthStore((s) => s.user?.vendorId) as string | undefined);
  const enabled = !!id;

  const list = useQuery({
    queryKey: [...HIGHLIGHTS_QUERY_KEY, id],
    queryFn: () => getVendorHighlights(id as string),
    enabled,
    staleTime: 30_000,
    placeholderData: [],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [...HIGHLIGHTS_QUERY_KEY, id] });

  const addHighlight = useMutation({
    mutationFn: (input: HighlightInput) => createHighlight(id as string, input),
    onSuccess: (data: Highlight) => {
      invalidate();
      toast.success(i18n.t("toasts.highlightCreated", { name: data.name }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editHighlight = useMutation({
    mutationFn: ({ highlightId, input }: { highlightId: string; input: Partial<HighlightInput> }) =>
      updateHighlight(id as string, highlightId, input),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('toasts.highlightUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeHighlight = useMutation({
    mutationFn: (highlightId: string) => deleteHighlight(id as string, highlightId),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('toasts.highlightRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addStory = useMutation({
    mutationFn: ({ highlightId, input }: { highlightId: string; input: StoryInput }) =>
      createStory(id as string, highlightId, input),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('toasts.storyAdded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editStory = useMutation({
    mutationFn: ({ highlightId, storyId, input }: { highlightId: string; storyId: string; input: Partial<StoryInput> }) =>
      updateStory(id as string, highlightId, storyId, input),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('toasts.storyUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeStory = useMutation({
    mutationFn: ({ highlightId, storyId }: { highlightId: string; storyId: string }) =>
      deleteStory(id as string, highlightId, storyId),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('toasts.storyRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveStory = useMutation({
    mutationFn: ({ highlightId, storyIds }: { highlightId: string; storyIds: string[] }) =>
      reorderStories(id as string, highlightId, storyIds),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    highlights: list.data ?? [],
    isLoading: list.isLoading,
    refetch: list.refetch,
    addHighlight,
    editHighlight,
    removeHighlight,
    addStory,
    editStory,
    removeStory,
    moveStory,
  };
};
