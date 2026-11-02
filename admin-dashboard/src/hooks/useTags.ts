import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listTags, createTag, updateTag, deleteTag, type TagListParams } from '../api/tags';
import type { ApiError } from '../api/client';

export const useTags = (params: TagListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'tags', params],
    queryFn: ({ signal }) => listTags(params, signal),
    placeholderData: (prev) => prev,
  });

export const useCreateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] });
      toast.success('Tag created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTag>[1] }) => updateTag(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] });
      toast.success('Tag updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] });
      toast.success('Tag deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
