'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken, getMustChangePassword, setTokens } from '@/lib/auth-client';
import { Card, ButtonGold } from '@/components/ui';

// Forced password reset — landed here because the account was just issued
// a one-time temporary password (see EmployeesService.createLoginInternal)
// and mustChangePassword is set. The API blocks every other endpoint until
// this succeeds (MustChangePasswordGuard); this page mirrors that
// client-side so the rest of the console isn't reachable in the meantime.
export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    if (!getMustChangePassword()) {
      router.replace('/');
      return;
    }
    setChecked(true);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setPending(true);
    try {
      const res = await authedFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not change password.');
        return;
      }
      setTokens(body.accessToken, body.refreshToken);
      router.push('/');
    } finally {
      setPending(false);
    }
  }

  if (!checked) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="p-7 w-full max-w-[420px]">
        <h1 className="font-serif text-lg text-center mb-1">Set a New Password</h1>
        <p className="text-[11.5px] text-text-2 text-center mb-4">
          You&apos;re signed in with a temporary password. Set your own before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase text-text-2 block mb-1">Temporary Password</label>
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-text-2 block mb-1">New Password</label>
            <input
              required
              minLength={8}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-text-2 block mb-1">Confirm New Password</label>
            <input
              required
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <ButtonGold type="submit" disabled={pending} className="w-full">
            {pending ? 'Saving…' : 'Set Password & Continue'}
          </ButtonGold>
        </form>
      </Card>
    </div>
  );
}
