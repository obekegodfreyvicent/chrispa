'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, ButtonGold, ButtonDanger } from '@/components/ui';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

function hoursBetween(start: string, end: string | null) {
  const endTime = end ? new Date(end).getTime() : Date.now();
  return ((endTime - new Date(start).getTime()) / 3_600_000).toFixed(1);
}

// HR Phase 2: My HR — Clock In / Out (self-service, web-based only)
export default function MyAttendancePage() {
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/attendance').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setEntries);
  }

  useRefetchOnFocus(load);

  async function clockIn() {
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch('/hr/me/attendance/clock-in', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) { setError(body?.message ?? 'Could not clock in.'); return; }
      load();
    } finally {
      setPending(false);
    }
  }

  async function clockOut() {
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch('/hr/me/attendance/clock-out', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) { setError(body?.message ?? 'Could not clock out.'); return; }
      load();
    } finally {
      setPending(false);
    }
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to clock in/out.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }

  const open = entries?.find((e) => !e.clockOut);

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">Clock In / Out</h1>
      <Card className="max-w-sm mb-4 text-center">
        <div className="text-[10px] uppercase text-text-2 mb-2">{open ? 'Currently clocked in since' : 'Not clocked in'}</div>
        {open && <div className="font-serif text-lg mb-3">{new Date(open.clockIn).toLocaleTimeString()}</div>}
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        {open ? (
          <ButtonDanger onClick={clockOut} disabled={pending} className="w-full">{pending ? 'Working…' : 'Clock Out'}</ButtonDanger>
        ) : (
          <ButtonGold onClick={clockIn} disabled={pending} className="w-full">{pending ? 'Working…' : 'Clock In'}</ButtonGold>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="text-[10px] uppercase text-text-2 p-2.5 pb-0">Recent</div>
        {!entries ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-surface-2">
                  <td className="p-2.5">{new Date(e.clockIn).toLocaleString()}</td>
                  <td className="p-2.5">{e.clockOut ? new Date(e.clockOut).toLocaleString() : <span className="text-gold-light">Active</span>}</td>
                  <td className="p-2.5">{hoursBetween(e.clockIn, e.clockOut)}h</td>
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
