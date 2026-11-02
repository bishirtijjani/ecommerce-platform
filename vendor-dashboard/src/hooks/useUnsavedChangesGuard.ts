import { useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router-dom';

/**
 * Unsaved-changes guard that works with the component <BrowserRouter> (which
 * does not support react-router's useBlocker — that hook throws outside a data
 * router). It covers:
 *
 *  1. Tab close / refresh → native beforeunload prompt.
 *  2. In-app link navigation (sidebar, back arrows, <Link>/<NavLink>) → a custom
 *     confirm dialog. On leave the pending path is navigated to.
 *
 * `dirty` is owned by the caller (typically computed by comparing the form to a
 * pristine snapshot); a successful save must set it to false before navigating.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useBeforeUnload(() => {
    if (dirtyRef.current) return true;
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      // Never interfere with new-tab, modifier or non-anchor navigations.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as Element | null)?.closest('a');
      if (!target) return;
      if (target.target === '_blank' || target.download) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // Only intercept same-app client-side paths (the app navigates internally
      // with relative hrefs like "/products").
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const cancelExit = () => setPendingPath(null);
  const confirmExit = () => {
    const path = pendingPath;
    setPendingPath(null);
    if (path) navigate(path);
  };

  return {
    showExitConfirm: pendingPath !== null,
    cancelExit,
    confirmExit,
  };
}
