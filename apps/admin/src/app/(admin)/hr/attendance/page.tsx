'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card } from '@/components/ui';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  employee: { firstName: string; lastName: string; employeeNumber: string };
}

function hoursBetween(start: string, end: string | null) {
  if (!end) return '—';
  const hrs = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return `${hrs.toFixed(1)}h`;
}

// HR Phase 2: Time & Attendance — admin oversight (web clock-in only, no
// biometric device integration — see docs/SRS.md §18.2)
export default function AttendancePage() {
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/attendance').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setEntries);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Owner or HR Manager role required.</p></Card>;
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">Attendance</h1>
      <Card className="p-0 overflow-hidden">
        {!entries ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No clock-ins recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Employee</th>
                <th className="p-2.5">Clock In</th>
                <th className="p-2.5">Clock Out</th>
                <th className="p-2.5">Hours</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-surface-2">
                  <td className="p-2.5">{e.employee.firstName} {e.employee.lastName}</td>
                  <td className="p-2.5">{new Date(e.clockIn).toLocaleString()}</td>
                  <td className="p-2.5">{e.clockOut ? new Date(e.clockOut).toLocaleString() : <span className="text-gold-light">Active</span>}</td>
                  <td className="p-2.5">{hoursBetween(e.clockIn, e.clockOut)}</td>
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
