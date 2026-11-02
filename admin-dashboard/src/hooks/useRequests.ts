import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listRequests, getRequest, deleteRequest, type RequestListParams } from '../api/requests';
import type { ApiError } from '../api/client';

export const useRequests = (params: RequestListParams = {}) =>
  useQuery({
    queryKey: ['requests', params],
    queryFn: ({ signal }) => listRequests(params, signal),
    placeholderData: (prev) => prev,
  });

export const useRequest = (id: string) =>
  useQuery({ queryKey: ['requests', id], queryFn: ({ signal }) => getRequest(id, signal), enabled: !!id });

export const useDeleteRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Request removed');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
