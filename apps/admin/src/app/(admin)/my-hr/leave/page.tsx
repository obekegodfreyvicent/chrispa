'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonGold, ButtonGhost } from '@/components/ui';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewNotes: string | null;
}
interface Balance {
  year: number;
  allocated: number;
  used: number;
  remaining: number;
}

const STATUS_VARIANT = { PENDING: 'pending', APPROVED: 'ok', REJECTED: 'danger', CANCELLED: 'danger' } as const;
const LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'];

// HR Phase 2: My HR — Leave requests (self-service)
export default function MyLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/leave-requests').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setRequests);
    authedFetch('/hr/me/leave-requests/balance').then((r) => (r.ok ? r.json() : null)).then(setBalance);
  }

  useRefetchOnFocus(load);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authedFetch('/hr/me/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, startDate, endDate, reason: reason || undefined }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Could not submit request.'));
      return;
    }
    setAdding(false);
    setStartDate('');
    setEndDate('');
    setReason('');
    load();
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this leave request?')) return;
    await authedFetch(`/hr/me/leave-requests/${id}`, { method: 'DELETE' });
    load();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to manage leave.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">My Leave</h1>
        <ButtonGold onClick={() => setAdding(true)}>+ Request Leave</ButtonGold>
      </div>

      {balance && (
        <Card className="mb-4 max-w-sm text-center">
          <div className="text-[10px] uppercase text-text-2 mb-1">Annual Leave Balance — {balance.year}</div>
          <div className="font-serif text-xl">{balance.remaining} <span className="text-sm text-text-2">/ {balance.allocated} days remaining</span></div>
          <div style={{ height: 6, borderRadius: 4, background: '#CBDCC1', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${(balance.used / balance.allocated) * 100}%`, height: '100%', background: 'var(--color-gold)' }} />
          </div>
        </Card>
      )}

      {adding && (
        <Card className="mb-4 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] text-text-2 block mb-1">Start date</label>
                <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              </div>
              <div>
                <label className="text-[10px] text-text-2 block mb-1">End date</label>
                <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              </div>
            </div>
            <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <ButtonGold type="submit">Submit Request</ButtonGold>
              <ButtonGhost type="button" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {!requests ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No leave requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
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
                  <td className="p-2.5"><Chip>{r.type}</Chip></td>
                  <td className="p-2.5">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</td>
                  <td className="p-2.5">{r.daysRequested}</td>
                  <td className="p-2.5">
                    <Status variant={STATUS_VARIANT[r.status]}>{r.status}</Status>
                    {r.reviewNotes && <div className="text-[10px] text-text-2 mt-1">{r.reviewNotes}</div>}
                  </td>
                  <td className="p-2.5">
                    {r.status === 'PENDING' && <button onClick={() => cancel(r.id)} className="text-danger">Cancel</button>}
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
