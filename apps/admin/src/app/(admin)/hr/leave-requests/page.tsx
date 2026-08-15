'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonGold, ButtonDanger } from '@/components/ui';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  employee: { firstName: string; lastName: string; employeeNumber: string };
}

const STATUS_VARIANT = { PENDING: 'pending', APPROVED: 'ok', REJECTED: 'danger', CANCELLED: 'danger' } as const;

// HR Phase 2: Leave and Absence Tracking — approval queue
export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    const params = tab === 'PENDING' ? '?status=PENDING' : '';
    authedFetch(`/hr/leave-requests${params}`).then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setRequests);
  }

  useRefetchOnFocus(load);

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    const reviewNotes = status === 'REJECTED' ? prompt('Reason for rejecting (optional):') ?? undefined : undefined;
    const res = await authedFetch(`/hr/leave-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNotes }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.message ?? 'Could not update this leave request.');
      return;
    }
    load();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Owner or HR Manager role required.</p></Card>;
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Leave Requests</h1>
        <div className="flex gap-2">
          <button onClick={() => { setTab('PENDING'); setTimeout(load, 0); }}><Chip gold={tab === 'PENDING'}>Pending</Chip></button>
          <button onClick={() => { setTab('ALL'); setTimeout(load, 0); }}><Chip gold={tab === 'ALL'}>All</Chip></button>
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        {!requests ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No {tab === 'PENDING' ? 'pending ' : ''}leave requests.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Employee</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Dates</th>
                <th className="p-2.5">Days</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-surface-2">
                  <td className="p-2.5">{r.employee.firstName} {r.employee.lastName}</td>
                  <td className="p-2.5">{r.type}</td>
                  <td className="p-2.5">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</td>
                  <td className="p-2.5">{r.daysRequested}</td>
                  <td className="p-2.5"><Status variant={STATUS_VARIANT[r.status]}>{r.status}</Status></td>
                  <td className="p-2.5">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <ButtonGold onClick={() => review(r.id, 'APPROVED')}>Approve</ButtonGold>
                        <ButtonDanger onClick={() => review(r.id, 'REJECTED')}>Reject</ButtonDanger>
                      </div>
                    )}
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
