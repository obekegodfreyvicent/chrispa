'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Kpi, Chip, Status, ButtonGhost, ButtonOutline, ButtonDanger } from '@/components/ui';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  tier: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  _count: { orders: number };
}

// FR-25: Customers (CRM), read side, real. Suspend/reactivate/delete are
// net-new admin actions (not in the original SRS) — see
// docs/07-authentication-and-authorization.md for the login-time
// enforcement these rely on. RFM segmentation, tags/notes, and
// campaign-list export are still follow-up work.
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/customers')
      .then((r) => (r.ok ? r.json() : []))
      .then(setCustomers);
  }

  useRefetchOnFocus(load);

  async function runAction(id: string, path: string, init: RequestInit) {
    setBusyId(id);
    setRowError(null);
    try {
      const res = await authedFetch(`/admin/customers/${id}${path}`, init);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError({ id, message: body?.message ?? 'Something went wrong' });
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  function suspend(id: string) {
    const reason = window.prompt('Reason for suspending this account (optional, shown in the audit log):');
    if (reason === null) return; // cancelled
    if (!window.confirm('Suspend this account? They will be signed out immediately and unable to log in until reactivated.')) return;
    runAction(id, '/suspend', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || undefined }),
    });
  }

  function reactivate(id: string) {
    if (!window.confirm('Reactivate this account? They will be able to log in again.')) return;
    runAction(id, '/reactivate', { method: 'PATCH' });
  }

  function remove(id: string, name: string) {
    if (
      !window.confirm(
        `Permanently delete "${name}"'s account? This scrubs their personal data and cannot be undone — order/review/support history is kept for the business's own records, but the account itself is gone. Suspend instead if you just need to block access.`,
      )
    )
      return;
    runAction(id, '', { method: 'DELETE' });
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  const vipCount = customers?.filter((c) => c.tier !== 'STANDARD').length ?? 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h1 className="font-serif text-xl">Customers (CRM)</h1>
        <ButtonGhost onClick={load}>Refresh</ButtonGhost>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Kpi label="Total Customers" value={customers ? String(customers.length) : '—'} />
        <Kpi label="VIP / Gold / Wholesale" value={String(vipCount)} />
      </div>
      <Card className="p-0 overflow-hidden">
        {!customers ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Tier</th>
                <th className="p-2.5">Orders</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-surface-2 align-top">
                  <td className="p-2.5">{c.name}</td>
                  <td className="p-2.5">
                    <Chip gold={c.tier !== 'STANDARD'}>{c.tier}</Chip>
                  </td>
                  <td className="p-2.5">{c._count.orders}</td>
                  <td className="p-2.5">
                    {c.suspendedAt ? (
                      <div>
                        <Status variant="danger">Suspended</Status>
                        {c.suspensionReason && (
                          <div className="text-[10px] text-text-2 mt-1 max-w-[180px]">{c.suspensionReason}</div>
                        )}
                      </div>
                    ) : (
                      <Status variant="ok">Active</Status>
                    )}
                  </td>
                  <td className="p-2.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {c.suspendedAt ? (
                        <ButtonOutline disabled={busyId === c.id} onClick={() => reactivate(c.id)}>
                          Reactivate
                        </ButtonOutline>
                      ) : (
                        <ButtonOutline disabled={busyId === c.id} onClick={() => suspend(c.id)}>
                          Suspend
                        </ButtonOutline>
                      )}
                      <ButtonDanger disabled={busyId === c.id} onClick={() => remove(c.id, c.name)}>
                        Delete
                      </ButtonDanger>
                    </div>
                    {rowError?.id === c.id && <p className="text-[10px] text-danger mt-1">{rowError.message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
