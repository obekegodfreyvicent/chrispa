'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { setTokens } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline } from '@/components/ui';
import { GoogleSignInButton } from '@/components/auth/google-signin-button';
import { OtpVerify } from '@/components/auth/otp-verify';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// FR-8: Log In. Email-or-phone + password, "Sign in with Google", TOTP 2FA
// as a second step, and WebAuthn (Biometric Login) as an alternate step when
// the account has either enabled (FR-17.1). Facebook/Apple social login and
// the SSO entry point shown in the wireframe still don't have a backend (see
// docs/SRS.md FR-8.4/8.5).
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // Set when login() reports { requiresVerification: true, userId } — an
  // account that registered but never finished the registration-OTP hard
  // gate (see AuthService.login()/register()). autoSend re-issues fresh
  // codes since the ones from registration time may be long expired.
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null);

  const [biometricPending, setBiometricPending] = useState(false);

  function completeAuth(accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    router.push('/account');
  }

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
      if (body.requiresVerification) {
        setUnverifiedUserId(body.userId);
        return;
      }
      if (body.requiresTwoFactor) {
        setChallengeToken(body.challengeToken);
        return;
      }
      completeAuth(body.accessToken, body.refreshToken);
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
      completeAuth(body.accessToken, body.refreshToken);
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
      completeAuth(verifyBody.accessToken, verifyBody.refreshToken);
    } finally {
      setBiometricPending(false);
    }
  }

  if (unverifiedUserId) {
    return <OtpVerify userId={unverifiedUserId} autoSend onComplete={completeAuth} />;
  }

  if (challengeToken) {
    return (
      <Card className="p-7">
        <h1 className="font-serif text-lg text-center mb-1">Two-Factor Authentication</h1>
        <p className="text-[11.5px] text-text-2 text-center mb-4">Enter the 6-digit code from your authenticator app.</p>
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
    );
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg text-center mb-4">Welcome back</h1>
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
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[11px] text-gold-light">
            Forgot Password?
          </Link>
        </div>
        <ButtonGold type="submit" disabled={pending} className="w-full">
          {pending ? 'Logging in…' : 'Log In'}
        </ButtonGold>
      </form>
      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 border-t border-surface-2" />
        <span className="text-[10px] text-text-2">or</span>
        <div className="flex-1 border-t border-surface-2" />
      </div>
      <ButtonOutline type="button" disabled={biometricPending} onClick={handleBiometricLogin} className="w-full mb-3">
        {biometricPending ? 'Verifying…' : '🔒 Log In with Biometric'}
      </ButtonOutline>
      <GoogleSignInButton onCredential={async (idToken) => {
        setError(null);
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.message ?? 'Could not log in with Google.');
          return;
        }
        completeAuth(body.accessToken, body.refreshToken);
      }} />
      <p className="text-center text-[11px] text-text-2 mt-4">
        New here? <Link href="/signup" className="text-gold-light">Create an Account</Link>
      </p>
    </Card>
  );
}
