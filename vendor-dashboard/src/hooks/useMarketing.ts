import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import { getDiscountCodes, createDiscountCode, type DiscountCodeInput } from '../api/vendor';
import { useAuthStore } from '../store/authStore';
import type { ApiError } from '../api/client';

const useVendorId = () => useAuthStore((s) => s.user?.vendorId) as string;

export const useDiscountCodes = () => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['discount-codes', vendorId],
    queryFn: () => getDiscountCodes(vendorId),
    enabled: !!vendorId,
  });
};

export const useCreateDiscountCode = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscountCodeInput) => createDiscountCode(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success(i18n.t('toasts.discountSubmitted'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
