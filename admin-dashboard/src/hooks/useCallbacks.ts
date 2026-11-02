import { useQuery } from '@tanstack/react-query';
import { listCallbacks, type CallbackListParams } from '../api/callbacks';

export const useCallbacks = (params: CallbackListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'callbacks', params],
    queryFn: ({ signal }) => listCallbacks(params, signal),
    placeholderData: (prev) => prev,
  });