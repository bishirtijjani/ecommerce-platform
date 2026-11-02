import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerWebPush } from '../services/push';

/**
 * Bridges service-worker messages to the SPA:
 *  - notification-click: deep-link a tapped push notification
 *  - push-resubscribe:   the browser rotated the subscription; re-save it
 */
export const ServiceWorkerBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

    const toRoute = (route?: string): string => {
      if (!route) return '/';
      if (route.startsWith('/vendor/orders/')) return route.replace('/vendor', '');
      if (route.startsWith('/vendor/requests/')) return route.replace('/vendor', '');
      if (route === '/vendor/orders' || route === '/orders') return '/orders';
      if (route.startsWith('/order/')) return `/orders/${route.split('/').pop()}`;
      if (route === '/vendor/requests' || route === '/requests') return '/requests';
      if (route.startsWith('/requests/')) return route;
      if (route.startsWith('/messages/')) return route;
      if (route.startsWith('/vendor/account/')) return route.replace('/vendor', '');
      if (route === '/vendor/shop' || route === '/shop') return '/shop';
      if (route === '/vendor/settings' || route === '/settings') return '/settings';
      if (route.startsWith('/support') || route.startsWith('/disputes')) return '/support';
      if (route.startsWith('/chat')) return '/messages';
      return '/';
    };

    const onMessage = (event: MessageEvent) => {
      const msg = event?.data;
      if (!msg) return;
      if (msg.type === 'push-resubscribe') {
        registerWebPush().catch(() => {});
        return;
      }
      if (msg.type === 'notification-click') {
        navigate(toRoute(msg.data?.route));
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  return null;
};
