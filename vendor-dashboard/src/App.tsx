import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageSpinner } from './components/ui/Spinner';
import { RequireAuth } from './components/RequireAuth';
import { VendorGate, AccountStatusGate } from './components/VendorGate';
import { AppShell } from './components/layout/AppShell';

const Login = lazy(() => import('./pages/auth/Login'));
const Continue = lazy(() => import('./pages/auth/Continue'));
const VerifyOtp = lazy(() => import('./pages/auth/VerifyOtp'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const BecomeVendor = lazy(() => import('./pages/sell/BecomeVendor'));

const OnboardingWizard = lazy(() => import('./pages/onboarding/OnboardingWizard'));
const PendingReview = lazy(() => import('./pages/onboarding/PendingReview'));
const Rejected = lazy(() => import('./pages/onboarding/Rejected'));
const Suspended = lazy(() => import('./pages/onboarding/Suspended'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const OrdersList = lazy(() => import('./pages/orders/OrdersList'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
const Messages = lazy(() => import('./pages/messages/Messages'));
const RequestsPage = lazy(() => import('./pages/requests/RequestsPage'));
const RequestDetailPage = lazy(() => import('./pages/requests/RequestDetailPage'));
const ProductsList = lazy(() => import('./pages/products/ProductsList'));
const ProductForm = lazy(() => import('./pages/products/ProductForm'));
const ShopProfile = lazy(() => import('./pages/profile/ShopProfile'));
const Highlights = lazy(() => import('./pages/highlights/Highlights'));
const ShopCategoriesPage = lazy(() => import('./pages/categories/ShopCategoriesPage'));
const Marketing = lazy(() => import('./pages/marketing/Marketing'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const SupportPage = lazy(() => import('./pages/support/SupportPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Auto-login button target from vendor emails. */}
        <Route path="/auth/continue" element={<Continue />} />
        {/* One wizard for everyone - old /register links funnel into it. */}
        <Route path="/sell" element={<BecomeVendor />} />
        <Route path="/register" element={<Navigate to="/sell" replace />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route element={<AccountStatusGate />}>
            <Route path="/account/pending" element={<PendingReview />} />
            <Route path="/account/rejected" element={<Rejected />} />
            <Route path="/account/suspended" element={<Suspended />} />
          </Route>

          <Route element={<VendorGate />}>
            <Route path="/onboarding" element={<OnboardingWizard />} />

            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<OrdersList />} />
              <Route path="/orders/:orderId" element={<OrderDetail />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:conversationId" element={<Messages />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/requests/:requestId" element={<RequestDetailPage />} />
              <Route path="/products" element={<ProductsList />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:productId" element={<ProductForm />} />
              <Route path="/shop" element={<ShopProfile />} />
              <Route path="/highlights" element={<Highlights />} />
              <Route path="/categories" element={<ShopCategoriesPage />} />
              <Route path="/categories/:categoryId" element={<ShopCategoriesPage />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
