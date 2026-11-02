import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { ensurePush } from '../../services/push';

export const AppShell = () => {
  // First authenticated paint: offer browser notifications (with a reason),
  // once per install if the operator hasn't decided yet.
  useEffect(() => {
    ensurePush('auto');
  }, []);

  return (
    <div className="flex min-h-screen bg-bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-text-onBrand"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
};
