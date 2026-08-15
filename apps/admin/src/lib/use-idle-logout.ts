'use client';

import { useEffect, useRef } from 'react';

// SRS §11 security requirement: admin session timeout. 5 minutes, per staff
// request — shorter than a typical consumer app because this console can
// change stock, prices, and order status.
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// Calls `onIdle` once the user has produced no mouse/keyboard/scroll/touch
// activity for IDLE_TIMEOUT_MS. Uses a ref for the callback so callers don't
// need to memoize it to avoid re-arming the timer on every render.
export function useIdleLogout(onIdle: () => void, enabled: boolean) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout>;
    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), IDLE_TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [enabled]);
}
