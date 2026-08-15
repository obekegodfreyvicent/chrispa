'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { getMustChangePassword, setTokens } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// useSearchParams() opts this subtree into client-side rendering — wrapping
// it in Suspense lets the rest of the login page still prerender. See
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md
function IdleNotice() {
  const params = useSearchParams();
  if (params.get('reason') !== 'idle') return null;
  return (
    <p className="text-[11px] text-gold-dark text-center mb-3 bg-surface-2 rounded-md py-2">
      You were logged out after 5 minutes of inactivity.
    </p>
  );
}

// Admin console login. Not in the wireframe set (which assumes an already-authenticated
// admin) — added because the RBAC-guarded /admin/* API endpoints require a real session.
// Also handles the TOTP 2FA second step (FR-17.1) — staff accounts share the
// same /auth/login endpoint as customers, so any account with 2FA enabled
// needs this here too, not just on the storefront.
export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const [biometricPending, setBiometricPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        setError('Invalid email/phone or password.');
        return;
      }
      const body = await res.json();
      if (body.requiresTwoFactor) {
        setChallengeToken(body.challengeToken);
        return;
      }
      setTokens(body.accessToken, body.refreshToken);
      router.push(getMustChangePassword() ? '/change-password' : '/');
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Incorrect code.');
        return;
      }
      setTokens(body.accessToken, body.refreshToken);
      router.push(getMustChangePassword() ? '/change-password' : '/');
    } finally {
      setPending(false);
    }
  }

  async function handleBiometricLogin() {
    if (!identifier) {
      setError('Enter your email or phone first, then use Biometric Login.');
      return;
    }
    setError(null);
    setBiometricPending(true);
    try {
      const optionsRes = await fetch(`${API_BASE_URL}/auth/webauthn/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const optionsBody = await optionsRes.json().catch(() => null);
      if (!optionsRes.ok) {
        setError(optionsBody?.message ?? 'Could not start biometric login.');
        return;
      }
      let response;
      try {
        response = await startAuthentication({ optionsJSON: optionsBody.options });
      } catch {
        setError('Biometric login was cancelled, or no biometric credential is registered for this device.');
        return;
      }
      const verifyRes = await fetch(`${API_BASE_URL}/auth/webauthn/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: optionsBody.challengeToken, response }),
      });
      const verifyBody = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) {
        setError(verifyBody?.message ?? 'Could not verify this device.');
        return;
      }
      setTokens(verifyBody.accessToken, verifyBody.refreshToken);
      router.push(getMustChangePassword() ? '/change-password' : '/');
    } finally {
      setBiometricPending(false);
    }
  }

  if (challengeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-7 w-full max-w-[420px]">
          <h1 className="font-serif text-lg text-center mb-1">Two-Factor Authentication</h1>
          <p className="text-[11px] text-text-2 text-center mb-4">Enter the 6-digit code from your authenticator app.</p>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <input
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] text-center tracking-widest"
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <ButtonGold type="submit" disabled={pending} className="w-full">
              {pending ? 'Verifying…' : 'Verify'}
            </ButtonGold>
            <ButtonOutline
              type="button"
              className="w-full"
              onClick={() => { setChallengeToken(null); setCode(''); setError(null); }}
            >
              Back to Log In
            </ButtonOutline>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="p-7 w-full max-w-[420px]">
        <h1 className="font-serif text-lg text-center mb-1">ChrisPa Admin</h1>
        <p className="text-[11px] text-text-2 text-center mb-4">Backend console — staff sign in</p>
        <Suspense fallback={null}>
          <IdleNotice />
        </Suspense>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase text-text-2 block mb-1">Email or Phone</label>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-text-2 block mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <ButtonGold type="submit" disabled={pending} className="w-full">
            {pending ? 'Logging in…' : 'Log In'}
          </ButtonGold>
        </form>
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 border-t border-surface-2" />
          <span className="text-[10px] text-text-2">or</span>
          <div className="flex-1 border-t border-surface-2" />
        </div>
        <ButtonOutline type="button" disabled={biometricPending} onClick={handleBiometricLogin} className="w-full">
          {biometricPending ? 'Verifying…' : '🔒 Log In with Biometric'}
        </ButtonOutline>
      </Card>
    </div>
  );
}
