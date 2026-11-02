import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { PendingBanner } from './PendingBanner';
import { useChatSocketBridge } from '../../hooks/useChat';
import { ensurePush } from '../../services/push';

export const AppShell = () => {
  // Keeps the chat socket connected + react-query caches (conversations,
  // unread badge) live for every screen under the authenticated shell, not
  // just the Messages page itself - so the sidebar/bottom-nav badge updates
  // even while a vendor is looking at Orders.
  useChatSocketBridge();

  // First authenticated paint: offer browser notifications (with a reason),
  // once per install if the vendor hasn't decided yet.
  useEffect(() => {
    ensurePush('auto');
  }, []);

  return (
    <div className="flex min-h-screen bg-bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <PendingBanner />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
};
