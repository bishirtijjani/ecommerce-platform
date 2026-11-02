import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PageSpinner } from './ui/Spinner';

export const RequireAdmin = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isInitialized) {
    return <PageSpinner />;
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
