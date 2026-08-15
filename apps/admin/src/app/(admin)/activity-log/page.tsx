'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip } from '@/components/ui';

interface ActivityLogEntry {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  // Resolved server-side (ActivityLogService.enrichWithActorIdentity()) from
  // the HR Employee record linked to actorUserId, if any — not stored on
  // the log row itself. actorDepartment is only ever set for staff with a
  // linked Employee record; customers and staff without an HR profile show
  // neither (department) or fall back to their login account's plain name.
  actorName: string | null;
  actorDepartment: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  createdAt: string;
}
interface DepartmentOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 30;

const ACTOR_TYPES = ['ALL', 'CUSTOMER', 'STAFF', 'SYSTEM'] as const;

// AL-FR-3 (docs/SRS.md §19): unified read of both customer and staff
// activity. OWNER-only, matching the server-side @Roles('OWNER') guard on
// GET /admin/activity-log — the nav item itself is also filtered to Owner
// in admin-shell.tsx, but that's cosmetic; this is the real boundary.
export default function ActivityLogPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [actorType, setActorType] = useState<(typeof ACTOR_TYPES)[number]>('ALL');
  const [action, setAction] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (actorType !== 'ALL') params.set('actorType', actorType);
    if (action) params.set('action', action);
    if (departmentId) params.set('departmentId', departmentId);
    if (search) params.set('search', search);
    params.set('skip', String(page * PAGE_SIZE));
    params.set('take', String(PAGE_SIZE));

    authedFetch(`/admin/activity-log?${params}`).then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        return;
      }
      return r.ok ? r.json() : { items: [], total: 0 };
    }).then((data) => {
      if (!data) return;
      setEntries(data.items);
      setTotal(data.total);
    });
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/activity-log/actions').then((r) => (r.ok ? r.json() : [])).then(setActions);
    authedFetch('/admin/activity-log/departments').then((r) => (r.ok ? r.json() : [])).then(setDepartments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, actorType, action, departmentId, search, page]);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner.
        </p>
      </Card>
    );
  }

  if (forbidden) {
    return (
      <Card>
        <p className="text-sm text-text-2">The activity log is Owner-only.</p>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2.5">
        <h1 className="font-serif text-xl">Activity Log</h1>
        <input
          placeholder="Search description…"
          value={search}
          onChange={(e) => { setPage(0); setSearch(e.target.value); }}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-64"
        />
      </div>

      <div className="flex gap-2 mb-3.5 flex-wrap items-center">
        {ACTOR_TYPES.map((t) => (
          <button key={t} onClick={() => { setPage(0); setActorType(t); }}>
            <Chip gold={actorType === t}>{t}</Chip>
          </button>
        ))}
        <select
          value={action}
          onChange={(e) => { setPage(0); setAction(e.target.value); }}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={departmentId}
          onChange={(e) => { setPage(0); setDepartmentId(e.target.value); }}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {!entries ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-gold-dark text-[10px] uppercase">
                  <th className="p-2.5">When</th>
                  <th className="p-2.5">Actor</th>
                  <th className="p-2.5">Department</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Entity</th>
                  <th className="p-2.5">Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-surface-2 align-top">
                    <td className="p-2.5 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="p-2.5">
                      <div className="font-semibold">{e.actorName ?? '—'}</div>
                      <Chip gold={e.actorType === 'STAFF'} className="mt-1">{e.actorRole ?? e.actorType}</Chip>
                    </td>
                    <td className="p-2.5 text-text-2">{e.actorDepartment ?? '—'}</td>
                    <td className="p-2.5 font-mono text-[10.5px]">{e.action}</td>
                    <td className="p-2.5 text-text-2">{e.entityType ?? '—'}</td>
                    <td className="p-2.5">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex justify-between items-center mt-3.5 text-[11.5px] text-text-2">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2.5 py-1.5 border border-[#CBDCC1] rounded-md disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1.5 border border-[#CBDCC1] rounded-md disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
