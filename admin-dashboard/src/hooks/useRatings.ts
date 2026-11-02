import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listRatings, deleteRating, type RatingListParams } from '../api/ratings';
import type { ApiError } from '../api/client';

export const useRatings = (params: RatingListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'ratings', params],
    queryFn: ({ signal }) => listRatings(params, signal),
    placeholderData: (prev) => prev,
  });

export const useDeleteRating = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRating,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ratings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Rating deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};