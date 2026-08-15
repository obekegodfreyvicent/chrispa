'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { authedFetch, clearTokens, getAccessToken, setTokens } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline, ButtonGhost, Switch } from '@/components/ui';

interface LoginEvent {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  isNewDevice: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

interface Settings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  notifyOrderUpdatesSms: boolean;
  notifyOrderUpdatesEmail: boolean;
  notifyPromotions: boolean;
  notifyPush: boolean;
  notifyLoginAlerts: boolean;
  unacknowledgedLoginAlert: LoginEvent | null;
}

type NotificationKey =
  | 'notifyOrderUpdatesSms'
  | 'notifyOrderUpdatesEmail'
  | 'notifyPromotions'
  | 'notifyPush'
  | 'notifyLoginAlerts';

const NOTIFICATION_LABELS: Record<NotificationKey, string> = {
  notifyOrderUpdatesSms: 'Order updates — SMS',
  notifyOrderUpdatesEmail: 'Order updates — Email',
  notifyPromotions: 'Promotions & Newsletter',
  notifyPush: 'Push Notifications',
  notifyLoginAlerts: 'Login Alerts (new device)',
};
const NOTIFICATION_PREF_KEYS: NotificationKey[] = ['notifyOrderUpdatesSms', 'notifyOrderUpdatesEmail', 'notifyPromotions', 'notifyPush'];

function formatDevice(event: LoginEvent) {
  return `${event.userAgent ?? 'Unknown device'} · ${event.ipAddress ?? 'unknown IP'}`;
}

// FR-17: Account Settings & Notification Preferences.
export default function SettingsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingKey, setSavingKey] = useState<NotificationKey | null>(null);

  const [twoFaSettingUp, setTwoFaSettingUp] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaPending, setTwoFaPending] = useState(false);

  const [disabling2fa, setDisabling2fa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disablePending, setDisablePending] = useState(false);

  const [biometricPending, setBiometricPending] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [disablingBiometric, setDisablingBiometric] = useState(false);
  const [disableBiometricPassword, setDisableBiometricPassword] = useState('');
  const [disableBiometricError, setDisableBiometricError] = useState<string | null>(null);
  const [disableBiometricPending, setDisableBiometricPending] = useState(false);

  const [loginEvents, setLoginEvents] = useState<LoginEvent[] | null>(null);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    authedFetch('/account/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function toggleNotification(key: NotificationKey) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);
    try {
      await authedFetch('/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } finally {
      setSavingKey(null);
    }
  }

  function loadLoginEvents() {
    authedFetch('/account/settings/login-events')
      .then((res) => (res.ok ? res.json() : null))
      .then(setLoginEvents);
  }

  async function startBiometricSetup() {
    setBiometricError(null);
    setBiometricPending(true);
    try {
      const optionsRes = await authedFetch('/auth/webauthn/register/options', { method: 'POST' });
      const optionsBody = await optionsRes.json().catch(() => null);
      if (!optionsRes.ok) {
        setBiometricError(optionsBody?.message ?? 'Could not start biometric setup.');
        return;
      }
      let response;
      try {
        response = await startRegistration({ optionsJSON: optionsBody.options });
      } catch {
        setBiometricError('Biometric setup was cancelled or is not available on this device.');
        return;
      }
      const verifyRes = await authedFetch('/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: optionsBody.challengeToken, response, deviceLabel: navigator.userAgent }),
      });
      const verifyBody = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) {
        setBiometricError(verifyBody?.message ?? 'Could not verify this device.');
        return;
      }
      setSettings((s) => (s ? { ...s, biometricEnabled: true } : s));
    } finally {
      setBiometricPending(false);
    }
  }

  async function handleDisableBiometric(e: React.FormEvent) {
    e.preventDefault();
    setDisableBiometricError(null);
    setDisableBiometricPending(true);
    try {
      const res = await authedFetch('/auth/webauthn/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: disableBiometricPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDisableBiometricError(body?.message ?? 'Could not disable biometric login.');
        return;
      }
      setSettings((s) => (s ? { ...s, biometricEnabled: false } : s));
      setDisablingBiometric(false);
      setDisableBiometricPassword('');
    } finally {
      setDisableBiometricPending(false);
    }
  }

  async function acknowledgeLoginAlert(id: string) {
    await authedFetch(`/account/settings/login-events/${id}/acknowledge`, { method: 'POST' });
    setSettings((s) => (s ? { ...s, unacknowledgedLoginAlert: null } : s));
    if (loginEvents) loadLoginEvents();
  }

  async function startTwoFactorSetup() {
    setTwoFaError(null);
    setTwoFaPending(true);
    try {
      const res = await authedFetch('/auth/2fa/enroll', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTwoFaError(body?.message ?? 'Could not start 2FA setup.');
        return;
      }
      setQrCodeDataUrl(body.qrCodeDataUrl);
      setManualEntryKey(body.manualEntryKey);
      setTwoFaSettingUp(true);
    } finally {
      setTwoFaPending(false);
    }
  }

  function cancelTwoFactorSetup() {
    setTwoFaSettingUp(false);
    setQrCodeDataUrl(null);
    setManualEntryKey(null);
    setTwoFaCode('');
    setTwoFaError(null);
  }

  async function confirmTwoFactorSetup(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaError(null);
    setTwoFaPending(true);
    try {
      const res = await authedFetch('/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFaCode }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setTwoFaError(body?.message ?? 'Incorrect code.');
        return;
      }
      setSettings((s) => (s ? { ...s, twoFactorEnabled: true } : s));
      cancelTwoFactorSetup();
    } finally {
      setTwoFaPending(false);
    }
  }

  async function handleDisableTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisablePending(true);
    try {
      const res = await authedFetch('/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: disablePassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDisableError(body?.message ?? 'Could not disable 2FA.');
        return;
      }
      setSettings((s) => (s ? { ...s, twoFactorEnabled: false } : s));
      setDisabling2fa(false);
      setDisablePassword('');
    } finally {
      setDisablePending(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordPending(true);
    try {
      const res = await authedFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setPasswordError(body?.message ?? 'Could not change password.');
        return;
      }
      setTokens(body.accessToken, body.refreshToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setChangingPassword(false);
    } finally {
      setPasswordPending(false);
    }
  }

  async function handleDownloadData() {
    setExporting(true);
    try {
      const res = await authedFetch('/account/settings/export');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chrispa-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    setDeletePending(true);
    try {
      const res = await authedFetch('/account/settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(body?.message ?? 'Could not delete account.');
        return;
      }
      clearTokens();
      router.push('/');
    } finally {
      setDeletePending(false);
    }
  }

  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to manage your settings.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Account Settings &amp; Notification Preferences</h1>

      {settings?.unacknowledgedLoginAlert && (
        <Card className="mb-4 border-gold-dark">
          <div className="flex justify-between items-center gap-3">
            <p className="text-xs">
              ⚠ New sign-in detected from an unrecognized device — {formatDevice(settings.unacknowledgedLoginAlert)} on{' '}
              {new Date(settings.unacknowledgedLoginAlert.createdAt).toLocaleString()}. Wasn&apos;t you?{' '}
              <button onClick={() => setChangingPassword(true)} className="text-gold-light underline">
                Change your password
              </button>.
            </p>
            <ButtonGhost onClick={() => acknowledgeLoginAlert(settings.unacknowledgedLoginAlert!.id)}>Dismiss</ButtonGhost>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Security</div>

          <div className="flex justify-between items-center py-2 text-xs">
            <span>Two-Factor Authentication</span>
            <Switch
              checked={!!settings?.twoFactorEnabled}
              disabled={twoFaPending || disablePending}
              onChange={(next) => (next ? startTwoFactorSetup() : setDisabling2fa(true))}
            />
          </div>

          {twoFaSettingUp && (
            <div className="bg-surface-2 rounded-md p-3 my-2 space-y-2">
              <p className="text-[11px] text-text-2">
                Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.
              </p>
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeDataUrl} alt="2FA setup QR code" className="w-32 h-32 mx-auto" />
              )}
              {manualEntryKey && (
                <p className="text-[10px] text-text-2 text-center break-all">Can&apos;t scan? Enter manually: {manualEntryKey}</p>
              )}
              <form onSubmit={confirmTwoFactorSetup} className="space-y-2">
                <input
                  required
                  maxLength={6}
                  placeholder="6-digit code"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
                />
                {twoFaError && <p className="text-xs text-danger">{twoFaError}</p>}
                <div className="flex gap-2">
                  <ButtonGold type="submit" disabled={twoFaPending}>{twoFaPending ? 'Verifying…' : 'Verify & Enable'}</ButtonGold>
                  <ButtonOutline type="button" onClick={cancelTwoFactorSetup}>Cancel</ButtonOutline>
                </div>
              </form>
            </div>
          )}

          {disabling2fa && (
            <form onSubmit={handleDisableTwoFactor} className="space-y-2 my-2">
              <p className="text-[11px] text-text-2">Enter your password to turn off Two-Factor Authentication.</p>
              <input
                required
                type="password"
                placeholder="Current password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
              {disableError && <p className="text-xs text-danger">{disableError}</p>}
              <div className="flex gap-2">
                <ButtonGold type="submit" disabled={disablePending}>{disablePending ? 'Disabling…' : 'Disable'}</ButtonGold>
                <ButtonOutline
                  type="button"
                  onClick={() => { setDisabling2fa(false); setDisablePassword(''); setDisableError(null); }}
                >
                  Cancel
                </ButtonOutline>
              </div>
            </form>
          )}

          <div className="flex justify-between items-center py-2 text-xs">
            <span>Biometric Login</span>
            <Switch
              checked={!!settings?.biometricEnabled}
              disabled={biometricPending || disableBiometricPending}
              onChange={(next) => (next ? startBiometricSetup() : setDisablingBiometric(true))}
            />
          </div>
          {biometricError && <p className="text-xs text-danger">{biometricError}</p>}

          {disablingBiometric && (
            <form onSubmit={handleDisableBiometric} className="space-y-2 my-2">
              <p className="text-[11px] text-text-2">Enter your password to turn off Biometric Login.</p>
              <input
                required
                type="password"
                placeholder="Current password"
                value={disableBiometricPassword}
                onChange={(e) => setDisableBiometricPassword(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
              {disableBiometricError && <p className="text-xs text-danger">{disableBiometricError}</p>}
              <div className="flex gap-2">
                <ButtonGold type="submit" disabled={disableBiometricPending}>
                  {disableBiometricPending ? 'Disabling…' : 'Disable'}
                </ButtonGold>
                <ButtonOutline
                  type="button"
                  onClick={() => { setDisablingBiometric(false); setDisableBiometricPassword(''); setDisableBiometricError(null); }}
                >
                  Cancel
                </ButtonOutline>
              </div>
            </form>
          )}

          <div className="flex justify-between items-center py-2 text-xs">
            <span>Login Alerts (new device)</span>
            <Switch
              checked={!!settings?.notifyLoginAlerts}
              disabled={savingKey === 'notifyLoginAlerts'}
              onChange={() => toggleNotification('notifyLoginAlerts')}
            />
          </div>
          <p className="text-[10.5px] text-text-2 mt-1.5">
            Login Alerts are delivered in-app (this banner + the sign-in history below), not by SMS/email — no delivery
            provider is connected yet.
          </p>
          <ButtonGhost
            className="mt-2"
            onClick={() => { setShowLoginHistory((v) => !v); if (!loginEvents) loadLoginEvents(); }}
          >
            {showLoginHistory ? 'Hide' : 'View'} Recent Sign-Ins
          </ButtonGhost>
          {showLoginHistory && (
            <div className="mt-2 space-y-1.5">
              {!loginEvents ? (
                <p className="text-[11px] text-text-2">Loading…</p>
              ) : (
                loginEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center text-[10.5px] text-text-2 border-b border-surface-2 py-1.5">
                    <span>{formatDevice(event)}</span>
                    <span className="flex items-center gap-1.5">
                      {new Date(event.createdAt).toLocaleString()}
                      {event.isNewDevice && <span className="text-gold-dark font-semibold">NEW</span>}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {changingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-2 mt-3">
              <input
                required
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
              <input
                required
                minLength={8}
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
              <input
                required
                minLength={8}
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
              />
              {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
              <div className="flex gap-2">
                <ButtonGold type="submit" disabled={passwordPending}>{passwordPending ? 'Saving…' : 'Save'}</ButtonGold>
                <ButtonOutline type="button" onClick={() => setChangingPassword(false)}>Cancel</ButtonOutline>
              </div>
            </form>
          ) : (
            <>
              <ButtonOutline className="mt-2.5" onClick={() => { setChangingPassword(true); setPasswordSaved(false); }}>
                Change Password
              </ButtonOutline>
              {passwordSaved && <p className="text-[11px] text-gold-dark mt-2">Password changed.</p>}
            </>
          )}
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Notification Preferences</div>
          {NOTIFICATION_PREF_KEYS.map((key) => (
            <div key={key} className="flex justify-between items-center py-2 text-xs">
              <span>{NOTIFICATION_LABELS[key]}</span>
              <Switch
                checked={!!settings?.[key]}
                disabled={savingKey === key}
                onChange={() => toggleNotification(key)}
              />
            </div>
          ))}
        </Card>
      </div>
      <Card className="mt-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Privacy &amp; Data</div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <ButtonOutline disabled={exporting} onClick={handleDownloadData}>
            {exporting ? 'Preparing…' : 'Download My Data'}
          </ButtonOutline>
          {!deletingAccount && (
            <button
              onClick={() => setDeletingAccount(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-transparent border border-danger text-danger"
            >
              Delete Account
            </button>
          )}
        </div>

        {deletingAccount ? (
          <form onSubmit={handleDeleteAccount} className="space-y-2 mt-3 max-w-sm">
            <p className="text-[11px] text-danger">
              This removes your addresses, saved payment methods, cart, wishlist, and biometric/login-session data
              immediately, and signs you out everywhere. Your order history is kept (for receipts, returns, and
              ChrisPa&apos;s own accounting records) but is no longer linked to any personal info — same reason orders
              are never fully erased elsewhere in ChrisPa. This can&apos;t be undone from here.
            </p>
            <input
              required
              type="password"
              placeholder="Current password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
            <input
              required
              placeholder='Type "DELETE" to confirm'
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
            {deleteError && <p className="text-xs text-danger">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deletePending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-semibold bg-danger text-white disabled:opacity-50"
              >
                {deletePending ? 'Deleting…' : 'Permanently Delete Account'}
              </button>
              <ButtonOutline
                type="button"
                onClick={() => { setDeletingAccount(false); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(null); }}
              >
                Cancel
              </ButtonOutline>
            </div>
          </form>
        ) : (
          <p className="text-[10.5px] text-text-2 mt-2">
            Deleting your account scrubs your personal data immediately. Order history is retained (never hard-deleted,
            same as everywhere else in ChrisPa) but disconnected from anything identifying.
          </p>
        )}
      </Card>
    </div>
  );
}
