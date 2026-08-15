'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setTokens } from '@/lib/auth-client';
import { Card, ButtonGold } from '@/components/ui';
import { GoogleSignInButton } from '@/components/auth/google-signin-button';
import { OtpVerify } from '@/components/auth/otp-verify';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// FR-9: Sign Up. Email + phone (Uganda +256 format — required, see
// RegisterDto) + password. register() creates the account but deliberately
// returns no tokens — AuthService.register()'s registration-OTP hard gate
// means the account can't log in until verify-otp confirms both channels
// (see OtpVerify below), so submitting here always transitions to that step
// rather than completing the login directly. "Sign up with Google" is the
// one path that skips OTP entirely, since Google has already verified the
// email server-side (see AuthService.googleLogin()).
export default function SignUpPage() {
  const router = useRouter();
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
    router.push('/account');
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
      <h1 className="font-serif text-lg text-center mb-4">Create your account</h1>
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
      <p className="text-center text-[11px] text-text-2 mt-4">
        Already have an account? <Link href="/login" className="text-gold-light">Log In</Link>
      </p>
    </Card>
  );
}
