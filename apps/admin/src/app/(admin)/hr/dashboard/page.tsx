'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Kpi } from '@/components/ui';

interface Summary {
  headcountByStatus: { status: string; count: number }[];
  totalHeadcount: number;
  headcountByDepartment: { id: string; name: string; count: number }[];
  pendingLeaveRequests: number;
  openJobPostings: number;
  clockedInNow: number;
  documentsExpiringSoon: number;
  goalCompletionRate: number | null;
  totalGoals: number;
  completedGoals: number;
}

// HR Phase 4 — HR Dashboards & Productivity Metrics. Everything here is
// computed on read from Phase 1-3 data, not a stored/cached counter.
export default function HrDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/dashboard').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return null;
      }
      return r.ok ? r.json() : null;
    }).then(setSummary);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as Owner or HR Manager.</p></Card>;
  }
  if (forbidden) {
    return <Card><p className="text-sm text-text-2">Owner or HR Manager role required.</p></Card>;
  }
  if (!summary) return <p className="text-sm text-text-2">Loading…</p>;

  const maxDept = Math.max(1, ...summary.headcountByDepartment.map((d) => d.count));

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">HR Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Kpi label="Total Headcount" value={String(summary.totalHeadcount)} />
        <Kpi label="Clocked In Now" value={String(summary.clockedInNow)} />
        <Kpi label="Pending Leave" value={String(summary.pendingLeaveRequests)} />
        <Kpi label="Open Postings" value={String(summary.openJobPostings)} />
        <Kpi label="Docs Expiring (30d)" value={String(summary.documentsExpiringSoon)} />
        <Kpi label="Goal Completion" value={summary.goalCompletionRate === null ? '—' : `${summary.goalCompletionRate}%`} delta={`${summary.completedGoals}/${summary.totalGoals} goals`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2.5">Headcount by Department</div>
          <div className="space-y-2">
            {summary.headcountByDepartment.map((d) => (
              <div key={d.id}>
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span>{d.name}</span>
                  <span className="text-text-2">{d.count}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#CBDCC1', overflow: 'hidden' }}>
                  <div style={{ width: `${(d.count / maxDept) * 100}%`, height: '100%', background: 'var(--color-gold)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2.5">Headcount by Status</div>
          <div className="space-y-1.5">
            {summary.headcountByStatus.map((s) => (
              <div key={s.status} className="flex justify-between text-[11.5px] border-b border-surface-2 pb-1.5 last:border-0">
                <span>{s.status.replace('_', ' ')}</span>
                <span className="text-text-2">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
