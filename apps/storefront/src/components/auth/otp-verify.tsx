'use client';

import { useEffect, useState } from 'react';
import { Card, ButtonGold } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

type Channel = 'EMAIL' | 'SMS';

interface Props {
  userId: string;
  // true when arriving here from login()'s { requiresVerification: true }
  // gate — an existing account whose original registration codes (from
  // register()) may be long expired, so fresh ones are requested up front.
  // false from the signup flow, where register() just sent them.
  autoSend?: boolean;
  onComplete: (accessToken: string, refreshToken: string) => void;
}

// FR-9's registration-OTP hard gate (see AuthService.register()/verifyOtp()):
// both email and phone codes must be confirmed before the account can log
// in. Shared between the signup flow and the login flow (an existing account
// that never finished verifying), since both land in exactly this state.
export function OtpVerify({ userId, autoSend = false, onComplete }: Props) {
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [verified, setVerified] = useState({ email: false, phone: false });
  const [pending, setPending] = useState<Channel | null>(null);
  const [resent, setResent] = useState<Record<Channel, boolean>>({ EMAIL: false, SMS: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoSend) return;
    void resend('EMAIL');
    void resend('SMS');
    // Only ever run once, on mount — resend() is stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend(channel: Channel) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel }),
      });
      if (res.ok) setResent((r) => ({ ...r, [channel]: true }));
    } catch {
      // Best-effort — the user can just press the button again.
    }
  }

  async function verify(channel: Channel, code: string) {
    if (!code) return;
    setError(null);
    setPending(channel);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, channel, code }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Incorrect code.');
        return;
      }
      // Once both channels are verified, verifyOtp() completes the login and
      // the response carries real tokens instead of a { verified } status.
      if (body.accessToken) {
        onComplete(body.accessToken, body.refreshToken);
        return;
      }
      setVerified({ email: !!body.verified?.email, phone: !!body.verified?.phone });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-lg text-center mb-1">Verify your account</h1>
      <p className="text-[11.5px] text-text-2 text-center mb-4">
        Enter the codes sent to your email and phone to finish creating your account.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Email code</label>
          <div className="flex gap-2">
            <input
              disabled={verified.email}
              inputMode="numeric"
              maxLength={6}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
              className="flex-1 bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] tracking-widest disabled:opacity-50"
            />
            <ButtonGold
              type="button"
              disabled={verified.email || pending === 'EMAIL'}
              onClick={() => verify('EMAIL', emailCode)}
            >
              {verified.email ? '✓ Verified' : pending === 'EMAIL' ? 'Verifying…' : 'Verify'}
            </ButtonGold>
          </div>
          {!verified.email && (
            <button
              type="button"
              onClick={() => resend('EMAIL')}
              className="text-[10.5px] text-gold-light mt-1"
            >
              {resent.EMAIL ? 'Code resent — check your inbox' : 'Resend code'}
            </button>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase text-text-2 block mb-1">Phone code</label>
          <div className="flex gap-2">
            <input
              disabled={verified.phone}
              inputMode="numeric"
              maxLength={6}
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              className="flex-1 bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] tracking-widest disabled:opacity-50"
            />
            <ButtonGold
              type="button"
              disabled={verified.phone || pending === 'SMS'}
              onClick={() => verify('SMS', phoneCode)}
            >
              {verified.phone ? '✓ Verified' : pending === 'SMS' ? 'Verifying…' : 'Verify'}
            </ButtonGold>
          </div>
          {!verified.phone && (
            <button
              type="button"
              onClick={() => resend('SMS')}
              className="text-[10.5px] text-gold-light mt-1"
            >
              {resent.SMS ? 'Code resent — check your SMS' : 'Resend code'}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
