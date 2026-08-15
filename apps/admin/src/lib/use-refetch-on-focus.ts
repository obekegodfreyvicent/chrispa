'use client';

import { useEffect, useRef } from 'react';

// Re-runs `fetchFn` on mount, and again whenever the tab regains focus or
// becomes visible. Client-fetched admin pages otherwise only load data once
// on mount — if the tab was already open (or Next's client-side router
// reused a cached component instance instead of remounting it) when new
// data landed elsewhere, the list silently goes stale until a hard refresh.
// This is what a customer registering while the CRM tab is open looked like.
export function useRefetchOnFocus(fetchFn: () => void) {
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    fetchFnRef.current();

    function handleFocus() {
      fetchFnRef.current();
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchFnRef.current();
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
