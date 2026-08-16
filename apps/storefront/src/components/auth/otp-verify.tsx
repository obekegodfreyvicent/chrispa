'use client';

import { useEffect, useState } from 'react';
import { Card, ButtonGold } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface Props {
  userId: string;
  // true when arriving here from login()'s { requiresVerification: true }
  // gate — an existing account whose original registration code (from
  // register()) may be long expired, so a fresh one is requested up front.
  // false from the signup flow, where register() just sent it.
  autoSend?: boolean;
  onComplete: (accessToken: string, refreshToken: string) => void;
}

// FR-9's registration-OTP hard gate (see AuthService.register()/verifyOtp()):
// the email code must be confirmed before the account can log in. Shared
// between the signup flow and the login flow (an existing account that never
// finished verifying), since both land in exactly this state.
//
// Phone/SMS verification is temporarily not part of this gate — the only
// Africa's Talking credentials on file are `sandbox`, which never delivers
// to a real phone, so showing a phone-code field here just left customers
// stuck on a code that could never arrive. See the matching note in
// apps/api/.../auth.service.ts's register(). Restore the phone step once a
// live AT key is configured.
export function OtpVerify({ userId, autoSend = false, onComplete }: Props) {
  const [emailCode, setEmailCode] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoSend) return;
    void resend();
    // Only ever run once, on mount — resend() is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel: 'EMAIL' }),
      });
      if (res.ok) setResent(true);
    } catch {
      // Best-effort — the user can just press the button again.
    }
  }

  async function verify() {
    if (!emailCode) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel: 'EMAIL', code: emailCode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Incorrect code.');
        return;
      }
      // verifyOtp() completes the login once email is verified — the
      // response carries real tokens instead of a { verified } status.
      if (body.accessToken) {
        onComplete(body.accessToken, body.refreshToken);
        return;
      }
      setVerifiedEmail(!!body.verified?.email);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg text-center mb-1">Verify your account</h1>
      <p className="text-[11.5px] text-text-2 text-center mb-4">
        Enter the code sent to your email to finish creating your account.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Email code</label>
          <div className="flex gap-2">
            <input
              disabled={verifiedEmail}
              inputMode="numeric"
              maxLength={6}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="flex-1 bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] tracking-widest disabled:opacity-50"
            />
            <ButtonGold type="button" disabled={verifiedEmail || pending} onClick={() => verify()}>
              {verifiedEmail ? '✓ Verified' : pending ? 'Verifying…' : 'Verify'}
            </ButtonGold>
          </div>
          {!verifiedEmail && (
            <button type="button" onClick={() => resend()} className="text-[10.5px] text-gold-light mt-1">
              {resent ? 'Code resent — check your inbox' : 'Resend code'}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
