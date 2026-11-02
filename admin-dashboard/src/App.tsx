import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageSpinner } from './components/ui/Spinner';
import { RequireAdmin } from './components/RequireAdmin';
import { AppShell } from './components/layout/AppShell';

const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const OrdersList = lazy(() => import('./pages/orders/OrdersList'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
const VendorsList = lazy(() => import('./pages/vendors/VendorsList'));
const VendorDetail = lazy(() => import('./pages/vendors/VendorDetail'));
const CustomersList = lazy(() => import('./pages/customers/CustomersList'));
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'));
const CategoriesPage = lazy(() => import('./pages/categories/CategoriesPage'));
const HomeCategoriesPage = lazy(() => import('./pages/home/HomeCategoriesPage'));
const TagsList = lazy(() => import('./pages/tags/TagsList'));
const SupportPage = lazy(() => import('./pages/support/SupportPage'));
const ChatOversightPage = lazy(() => import('./pages/chat/ChatOversightPage'));
const MarketingPage = lazy(() => import('./pages/marketing/MarketingPage'));
const RatingsPage = lazy(() => import('./pages/ratings/RatingsPage'));
const CallbacksPage = lazy(() => import('./pages/callbacks/CallbacksPage'));
const RequestsPage = lazy(() => import('./pages/requests/RequestsPage'));
const RequestDetailPage = lazy(() => import('./pages/requests/RequestDetailPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAdmin />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route path="/vendors" element={<VendorsList />} />
            <Route path="/vendors/:vendorId" element={<VendorDetail />} />
            {/* Products live inside their vendor - no standalone catalogue. */}
            <Route path="/products" element={<Navigate to="/vendors" replace />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/:customerId" element={<CustomerDetail />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:categoryId" element={<CategoriesPage />} />
            <Route path="/home-categories" element={<HomeCategoriesPage />} />
            <Route path="/tags" element={<TagsList />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/chat" element={<ChatOversightPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/ratings" element={<RatingsPage />} />
            <Route path="/callbacks" element={<CallbacksPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/:requestId" element={<RequestDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
