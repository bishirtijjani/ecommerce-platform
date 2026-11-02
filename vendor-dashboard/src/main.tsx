import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './i18n';
import App from './App';
import { registerForceLogout } from './api/client';
import { useAuthStore } from './store/authStore';
import { PushPermissionPrompt } from './components/PushPermissionPrompt';
import { ServiceWorkerBridge } from './components/ServiceWorkerBridge';

// Register the push service worker (served from /sw.js). No-op where
// service workers aren't supported.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}

registerForceLogout(() => {
  useAuthStore.getState().logout();
  window.location.href = '/login';
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ServiceWorkerBridge />
        <PushPermissionPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgb(var(--bg-surface))',
              color: 'rgb(var(--text-primary))',
              border: '1px solid rgb(var(--border-default))',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
