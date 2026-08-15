'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, Status, ButtonOutline } from '@/components/ui';

interface AdminUser {
  id: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
}

// FR-28: Users & Settings. Admin-user list is real (Owner-only); store
// configuration, integration toggles, and security panel are static —
// there's no settings-write endpoint yet.
export default function SettingsPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/users').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setUsers);
  }, []);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as the store Owner.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">Users &amp; Settings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Admin Users</div>
          {forbidden ? (
            <p className="text-sm text-text-2">Owner role required to view admin users.</p>
          ) : !users?.length ? (
            <p className="text-sm text-text-2">No admin/staff users yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-gold-dark text-[10px] uppercase">
                  <th className="py-1.5">Name</th>
                  <th className="py-1.5">Role</th>
                  <th className="py-1.5">2FA</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-surface-2">
                    <td className="py-1.5">{u.name}</td>
                    <td className="py-1.5">
                      <Chip>{u.role.replace('_', ' ')}</Chip>
                    </td>
                    <td className="py-1.5">
                      <Status variant={u.twoFactorEnabled ? 'ok' : 'danger'}>{u.twoFactorEnabled ? 'On' : 'Off'}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          <ButtonOutline disabled className="mt-2.5">+ Invite Admin</ButtonOutline>
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Integrations</div>
          <div className="flex gap-2 flex-wrap">
            <Chip gold>Mobile Money API ✓</Chip>
            <Chip>SMS Gateway</Chip>
            <Chip>Google Analytics</Chip>
            <Chip>Meta Pixel</Chip>
          </div>
          <div className="border-t border-surface-2 my-3.5" />
          <div className="text-[10px] uppercase text-text-2 mb-1">Security</div>
          <small className="text-[11px] text-text-2 block">Session timeout: 5 min of inactivity (auto logout)</small>
          <small className="text-[11px] text-text-2 block mt-1">
            Store-configuration and integration-toggle write endpoints are follow-up work.
          </small>
        </Card>
      </div>
    </div>
  );
}
