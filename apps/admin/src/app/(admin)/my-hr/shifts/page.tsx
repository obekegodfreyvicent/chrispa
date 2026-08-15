'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonOutline, ButtonGold, ButtonGhost } from '@/components/ui';

interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
}
interface Shift {
  id: string;
  startAt: string;
  endAt: string;
  role: string | null;
}
interface SwapRequest {
  id: string;
  status: string;
  shift: Shift;
  requestedBy: EmployeeSummary;
  coverEmployee: EmployeeSummary;
}

const STATUS_VARIANT = { PENDING: 'pending', APPROVED: 'ok', REJECTED: 'danger', CANCELLED: 'danger' } as const;

// HR Phase 2: My HR — My Shifts (self-service view + swap requests)
export default function MyShiftsPage() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [swaps, setSwaps] = useState<SwapRequest[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [coverEmployeeId, setCoverEmployeeId] = useState('');
  const [reason, setReason] = useState('');

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/shifts').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setShifts);
    authedFetch('/hr/me/shifts/swap-requests').then((r) => (r.ok ? r.json() : [])).then(setSwaps);
    // Public-ish employee directory for picking a colleague to cover — reuses
    // the admin employees endpoint, which 403s cleanly for non-HR staff;
    // that's fine, the swap-partner picker just won't populate for them.
    authedFetch('/hr/employees').then((r) => (r.ok ? r.json() : [])).then(setEmployees).catch(() => {});
  }

  useRefetchOnFocus(load);

  async function requestSwap(shiftId: string) {
    await authedFetch(`/hr/me/shifts/${shiftId}/swap-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverEmployeeId, reason: reason || undefined }),
    });
    setSwapFor(null);
    setCoverEmployeeId('');
    setReason('');
    load();
  }

  async function cancelSwap(id: string) {
    await authedFetch(`/hr/me/shifts/swap-requests/${id}`, { method: 'DELETE' });
    load();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to view your shifts.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">My Shifts</h1>

      {!!swaps?.length && (
        <Card className="mb-4">
          <div className="text-[10px] uppercase text-text-2 mb-2">My Swap Requests</div>
          {swaps.map((s) => (
            <div key={s.id} className="flex justify-between items-center py-2 border-b border-surface-2 last:border-0 text-[11.5px]">
              <div>
                {new Date(s.shift.startAt).toLocaleString()} · cover: {s.coverEmployee.firstName} {s.coverEmployee.lastName}
              </div>
              <div className="flex items-center gap-1.5">
                <Status variant={STATUS_VARIANT[s.status as keyof typeof STATUS_VARIANT] ?? 'pending'}>{s.status}</Status>
                {s.status === 'PENDING' && <button onClick={() => cancelSwap(s.id)} className="text-danger text-xs">Cancel</button>}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {!shifts ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No shifts scheduled for you.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Start</th>
                <th className="p-2.5">End</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t border-surface-2">
                  <td className="p-2.5">{new Date(s.startAt).toLocaleString()}</td>
                  <td className="p-2.5">{new Date(s.endAt).toLocaleString()}</td>
                  <td className="p-2.5">{s.role ? <Chip>{s.role}</Chip> : '—'}</td>
                  <td className="p-2.5">
                    <ButtonOutline onClick={() => setSwapFor(swapFor === s.id ? null : s.id)}>Request Swap</ButtonOutline>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {swapFor && (
        <Card className="mt-4 max-w-md">
          <div className="text-[10px] uppercase text-text-2 mb-2">Request a swap</div>
          <select required value={coverEmployeeId} onChange={(e) => setCoverEmployeeId(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-2.5">
            <option value="" disabled>Who should cover this shift?</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
          </select>
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-2.5" />
          <div className="flex gap-2">
            <ButtonGold onClick={() => requestSwap(swapFor)} disabled={!coverEmployeeId}>Submit</ButtonGold>
            <ButtonGhost onClick={() => setSwapFor(null)}>Cancel</ButtonGhost>
          </div>
        </Card>
      )}
    </div>
  );
}
