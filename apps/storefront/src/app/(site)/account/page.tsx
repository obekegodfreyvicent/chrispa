'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { authedFetch, getAccessToken, logout, setTokens } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline } from '@/components/ui';
import { GoogleSignInButton } from '@/components/auth/google-signin-button';
import { OtpVerify } from '@/components/auth/otp-verify';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface Me {
  role: string;
  tier: string;
}
interface Loyalty {
  pointsBalance: number;
  tier: string;
}

// FR-11: Account Overview — central hub linking every account sub-feature.
// Also doubles as the storefront's sign-in/sign-up entry point: the header's
// "Account" link always points here (see site-header.tsx), and this page
// itself renders the Log In / Create Account forms when signed out rather
// than sending the visitor to the separate standalone /login page — so
// "Account" is one destination for both a returning and a brand-new
// customer, still inside the normal storefront layout (header/footer).
export default function AccountOverviewPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async () => {
    if (!getAccessToken()) {
      setMe(null);
      setLoyalty(null);
      setLoading(false);
      return;
    }
    const [meRes, loyaltyRes] = await Promise.all([
      authedFetch('/auth/me').then((r) => (r.ok ? r.json() : null)),
      authedFetch('/loyalty').then((r) => (r.ok ? r.json() : null)),
    ]);
    setMe(meRes);
    setLoyalty(loyaltyRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (loading) return <p className="text-sm text-text-2">Loading…</p>;

  if (!me) {
    // Not signed in yet — the page is nothing but these two separate,
    // independently-functional forms (Log In for an existing account,
    // Create Account for a new one). A full reload on success — rather than
    // just re-fetching /auth/me here — is what flips SiteHeader (Log Out)
    // and AccountLayout (the sub-nav sidebar) over too; neither re-checks
    // its own signed-in state on anything but mount.
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <LoginForm onSuccess={() => window.location.reload()} />
        <RegisterForm onSuccess={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Account Overview</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-[10px] uppercase text-text-2 mb-1">Loyalty Points</div>
          <div className="font-serif text-xl">{loyalty?.pointsBalance ?? 0}</div>
          <div className="text-[10.5px] text-gold-light">{loyalty?.tier ?? me.tier} Tier</div>
        </Card>
        <Card className="text-center">
          <div className="text-[10px] uppercase text-text-2 mb-1">Account Role</div>
          <div className="font-serif text-xl capitalize">{me.role.toLowerCase()}</div>
        </Card>
        <Link href="/account/orders">
          <Card className="text-center hover:border-gold-dark transition-colors">
            <div className="text-[10px] uppercase text-text-2 mb-1">Orders</div>
            <div className="text-xl">▤</div>
          </Card>
        </Link>
        <Link href="/account/wishlist">
          <Card className="text-center hover:border-gold-dark transition-colors">
            <div className="text-[10px] uppercase text-text-2 mb-1">Wishlist</div>
            <div className="text-xl">♡</div>
          </Card>
        </Link>
        <button onClick={handleLogout} className="text-left">
          <Card className="text-center hover:border-danger transition-colors text-danger">
            <div className="text-[10px] uppercase mb-1">Log Out</div>
            <div className="text-xl">⏻</div>
          </Card>
        </button>
      </div>
    </div>
  );
}

// Same password + TOTP 2FA + WebAuthn/biometric flow as (auth)/login/page.tsx
// (that standalone page still exists for direct links), reused here so the
// embedded form is fully functional, not a placeholder. On any successful
// path it calls onSuccess() instead of navigating — this component is
// already on /account, it just needs to swap from "forms" to "dashboard".
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // Same as (auth)/login/page.tsx: login() reports { requiresVerification:
  // true, userId } for an account that never finished the registration-OTP
  // hard gate — this drops into the same OtpVerify component used by the
  // signup flow below.
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null);

  const [biometricPending, setBiometricPending] = useState(false);

  function completeAuth(accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    onSuccess();
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
      <h1 className="font-serif text-lg mb-1">Log In</h1>
      <p className="text-[11px] text-text-2 mb-4">
        Already have a ChrisPa account? Enter the email or phone number and password you registered
        with to sign in and pick up right where you left off — orders, wishlist, and loyalty points.
      </p>
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
    </Card>
  );
}

// Same fields/validation as (auth)/signup/page.tsx (still exists for direct
// links), reused here so this form works on its own rather than just
// pointing at the standalone page.
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+256');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  function completeAuth(accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    onSuccess();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError('Please agree to the Terms & Privacy Policy.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not create your account.');
        return;
      }
      setPendingUserId(body.userId);
    } finally {
      setPending(false);
    }
  }

  if (pendingUserId) {
    return <OtpVerify userId={pendingUserId} onComplete={completeAuth} />;
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg mb-1">Create an Account</h1>
      <p className="text-[11px] text-text-2 mb-4">
        New to ChrisPa? Fill in your name, email, phone, and a password to create a free account —
        track orders, save addresses, and start earning loyalty points on every purchase.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Full Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Email Address</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Phone Number</label>
          <input
            required
            type="tel"
            pattern="\+256\d{9}"
            title="Phone must be in the format +256XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <small className="text-[10px] text-text-2">Format: +256XXXXXXXXX — we&apos;ll text you a verification code.</small>
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Password</label>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
          />
          <small className="text-[10px] text-text-2">Min. 8 characters, 1 number</small>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-text-2">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I agree to the Terms &amp; Privacy Policy
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <ButtonGold type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating account…' : 'Create Account'}
        </ButtonGold>
      </form>
      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 border-t border-surface-2" />
        <span className="text-[10px] text-text-2">or</span>
        <div className="flex-1 border-t border-surface-2" />
      </div>
      <GoogleSignInButton onCredential={async (idToken) => {
        setError(null);
        const res = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.message ?? 'Could not sign up with Google.');
          return;
        }
        completeAuth(body.accessToken, body.refreshToken);
      }} />
    </Card>
  );
}
