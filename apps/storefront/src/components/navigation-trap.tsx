'use client';

import { useEffect } from 'react';

// De-activates the browser's Back/Forward navigation controls across the
// whole storefront, per explicit user decision — a deliberate deviation
// from normal browser behavior, not an oversight. No browser API lets a
// page actually disable/hide the real toolbar buttons, so this works by
// neutralizing their *effect*.
//
// First attempt tracked "the current URL" via usePathname()/useSearchParams()
// in a ref updated by a useEffect, and reverted on popstate via
// window.location.replace(ref.current). That raced Next's own App Router
// popstate handling, which wraps its state update in ReactDOM.flushSync()
// (to avoid a flash of stale content during back/forward) — flushSync also
// forces pending passive effects to flush synchronously, so Next's *own*
// popstate listener (registered before ours, so it always runs first)
// caused our ref-tracking effect to fire and overwrite the ref with the
// *new* (unwanted) path before our own listener ever read it — confirmed
// via live instrumentation, not a guess: the ref held the old page right
// up until a popstate fired, then read as the new page at the moment our
// handler ran.
//
// Tracking the History API directly instead sidesteps React's render/effect
// timing entirely: a popstate event is never itself the result of a
// pushState/replaceState call (it fires from traversing *existing* history
// entries), so the last URL recorded here via an intercepted
// pushState/replaceState call is guaranteed to still be the page the user
// was actually on right before the Back/Forward press, no matter what
// Next's own handler does in reaction to that same event.
export function NavigationTrap() {
  useEffect(() => {
    let currentUrl = window.location.pathname + window.location.search;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<History['pushState']>) => {
      const result = originalPushState(...args);
      currentUrl = window.location.pathname + window.location.search;
      return result;
    }) as History['pushState'];

    window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      const result = originalReplaceState(...args);
      currentUrl = window.location.pathname + window.location.search;
      return result;
    }) as History['replaceState'];

    // A second history entry to "consume" so the very first Back press
    // still fires popstate rather than leaving the site outright.
    window.history.pushState(null, '', window.location.href);

    function handlePopState() {
      window.location.replace(currentUrl);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
