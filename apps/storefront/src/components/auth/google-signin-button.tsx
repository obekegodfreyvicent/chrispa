'use client';

import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// FR-8.4/FR-9.4: "Sign in with Google" / "Sign up with Google". Renders
// Google Identity Services' own button, which hands back a signed ID token
// via `callback` — that token goes straight to POST /auth/google and is
// never a client secret (see AuthService.googleLogin(), which verifies its
// signature server-side before trusting any claim in it). Renders nothing if
// NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set, mirroring the API's own "Google
// sign-in is not configured" fallback for the same missing credential.
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !divRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => onCredential(response.credential),
    });
    window.google.accounts.id.renderButton(divRef.current, {
      theme: 'outline',
      size: 'large',
      width: 360,
      text: 'continue_with',
    });
  }, [scriptLoaded, onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={divRef} className="flex justify-center" />;
}
