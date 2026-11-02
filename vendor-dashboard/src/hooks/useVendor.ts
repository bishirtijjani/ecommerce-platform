import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import { getVendorProfile, toggleVendorStatus } from '../api/vendor';
import { useAuthStore } from '../store/authStore';

export const VENDOR_PROFILE_KEY = ['vendor-profile'];

export const useVendorProfile = () => {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  return useQuery({
    queryKey: [...VENDOR_PROFILE_KEY, vendorId],
    queryFn: () => getVendorProfile(vendorId as string),
    enabled: !!vendorId,
    staleTime: 30_000,
  });
};

export const useToggleShopStatus = () => {
  const vendorId = useAuthStore((s) => s.user?.vendorId) as string;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isOpen: boolean) => toggleVendorStatus(vendorId, isOpen),
    onSuccess: (data) => {
      qc.setQueryData([...VENDOR_PROFILE_KEY, vendorId], data);
      toast.success(i18n.t(data.isOpen ? 'toasts.shopOpen' : 'toasts.shopClosed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
};
