'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, Status } from '@/components/ui';

interface Ticket {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string | null } | null;
  _count: { messages: number };
}

const TABS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const STATUS_VARIANT: Record<string, 'ok' | 'pending' | 'danger'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'pending',
  RESOLVED: 'ok',
  CLOSED: 'pending',
};

// FR-7.4: Support Tickets — admin review/response (real — list/filter/search
// against /admin/support/tickets).
export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [authed, setAuthed] = useState(true);

  function load() {
    const params = new URLSearchParams();
    if (tab !== 'ALL') params.set('status', tab);
    if (search) params.set('search', search);
    authedFetch(`/admin/support/tickets?${params}`).then((r) => (r.ok ? r.json() : [])).then(setTickets);
    authedFetch('/admin/support/tickets/counts').then((r) => (r.ok ? r.json() : {})).then(setCounts);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Support Agent.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Support Tickets</h1>
        <input
          placeholder="Search ticket text or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-64"
        />
      </div>
      <div className="flex gap-2 mb-3.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            <Chip gold={tab === t}>
              {t.replace('_', ' ')} ({counts[t] ?? 0})
            </Chip>
          </button>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        {!tickets ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No tickets found.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Issue</th>
                <th className="p-2.5">Messages</th>
                <th className="p-2.5">Raised</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-surface-2">
                  <td className="p-2.5">{t.user?.name ?? '—'}</td>
                  <td className="p-2.5 max-w-xs truncate">{t.body}</td>
                  <td className="p-2.5">{t._count.messages}</td>
                  <td className="p-2.5">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="p-2.5">
                    <Status variant={STATUS_VARIANT[t.status] ?? 'pending'}>{t.status.replace('_', ' ')}</Status>
                  </td>
                  <td className="p-2.5">
                    <Link href={`/support-tickets/${t.id}`} className="text-gold-light">View</Link>
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
