'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, ButtonGold, ButtonGhost } from '@/components/ui';

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
  employee: EmployeeSummary;
}
interface SwapRequest {
  id: string;
  status: string;
  reason: string | null;
  shift: Shift;
  requestedBy: EmployeeSummary;
  coverEmployee: EmployeeSummary;
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// HR Phase 2: Shift Scheduling — roster + swap-request review. Overtime is
// not a separate tracked ledger — see docs/SRS.md §18.2 scope note.
export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [swaps, setSwaps] = useState<SwapRequest[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [adding, setAdding] = useState(false);

  const now = new Date();
  const [employeeId, setEmployeeId] = useState('');
  const [startAt, setStartAt] = useState(toLocalInput(now));
  const [endAt, setEndAt] = useState(toLocalInput(new Date(now.getTime() + 8 * 3600_000)));
  const [role, setRole] = useState('');

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/shifts').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setShifts);
    authedFetch('/hr/shifts/swap-requests?status=PENDING').then((r) => (r.ok ? r.json() : [])).then(setSwaps);
    authedFetch('/hr/employees').then((r) => (r.ok ? r.json() : [])).then(setEmployees);
  }

  useRefetchOnFocus(load);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch('/hr/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), role: role || undefined }),
    });
    setAdding(false);
    setRole('');
    load();
  }

  async function removeShift(id: string) {
    if (!confirm('Cancel this shift?')) return;
    await authedFetch(`/hr/shifts/${id}`, { method: 'DELETE' });
    load();
  }

  async function reviewSwap(id: string, status: 'APPROVED' | 'REJECTED') {
    await authedFetch(`/hr/shifts/swap-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
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
        <h1 className="font-serif text-xl">Shift Scheduling</h1>
        <ButtonGold onClick={() => setAdding(true)}>+ Add Shift</ButtonGold>
      </div>

      {adding && (
        <Card className="mb-4 max-w-xl">
          <form onSubmit={handleCreate} className="space-y-2.5">
            <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
              <option value="" disabled>Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] text-text-2 block mb-1">Start</label>
                <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              </div>
              <div>
                <label className="text-[10px] text-text-2 block mb-1">End</label>
                <input required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
                  className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              </div>
            </div>
            <input placeholder="Role / note (optional)" value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <div className="flex gap-2">
              <ButtonGold type="submit">Save Shift</ButtonGold>
              <ButtonGhost type="button" onClick={() => setAdding(false)}>Cancel</ButtonGhost>
            </div>
          </form>
        </Card>
      )}

      {!!swaps?.length && (
        <Card className="mb-4">
          <div className="text-[10px] uppercase text-text-2 mb-2">Pending Swap Requests</div>
          {swaps.map((s) => (
            <div key={s.id} className="flex justify-between items-center py-2 border-b border-surface-2 last:border-0 text-[11.5px]">
              <div>
                {s.requestedBy.firstName} {s.requestedBy.lastName} → {s.coverEmployee.firstName} {s.coverEmployee.lastName}
                <span className="text-text-2"> · {new Date(s.shift.startAt).toLocaleString()}</span>
                {s.reason && <div className="text-[10px] text-text-2">&ldquo;{s.reason}&rdquo;</div>}
              </div>
              <div className="flex gap-1.5">
                <ButtonGold onClick={() => reviewSwap(s.id, 'APPROVED')}>Approve</ButtonGold>
                <ButtonGhost onClick={() => reviewSwap(s.id, 'REJECTED')}>Reject</ButtonGhost>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {!shifts ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No shifts scheduled.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Employee</th>
                <th className="p-2.5">Start</th>
                <th className="p-2.5">End</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t border-surface-2">
                  <td className="p-2.5">{s.employee.firstName} {s.employee.lastName}</td>
                  <td className="p-2.5">{new Date(s.startAt).toLocaleString()}</td>
                  <td className="p-2.5">{new Date(s.endAt).toLocaleString()}</td>
                  <td className="p-2.5">{s.role ? <Chip>{s.role}</Chip> : '—'}</td>
                  <td className="p-2.5"><button onClick={() => removeShift(s.id)} className="text-danger">Cancel</button></td>
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
