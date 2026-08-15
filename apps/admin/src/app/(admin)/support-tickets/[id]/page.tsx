'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, Status, ButtonGold } from '@/components/ui';

interface TicketMessage {
  id: string;
  authorUserId: string;
  authorRole: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}
interface TicketDetail {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  messages: TicketMessage[];
  user: { name: string; email: string | null; phone: string | null } | null;
  order: { id: string; orderNumber: string } | null;
}

const ALL_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const STATUS_VARIANT: Record<string, 'ok' | 'pending' | 'danger'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'pending',
  RESOLVED: 'ok',
  CLOSED: 'pending',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// FR-7.4: Support ticket detail — staff review, reply, and status control.
export default function AdminTicketDetailPage(props: PageProps<'/support-tickets/[id]'>) {
  const { id } = use(props.params);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState('');

  function load() {
    authedFetch(`/admin/support/tickets/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTicket)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function transition(status: string) {
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch(`/admin/support/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not update ticket status.');
        return;
      }
      setTicket(body);
    } finally {
      setPending(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch(`/admin/support/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not send your reply.');
        return;
      }
      setTicket(body);
      setReply('');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Support Agent.
        </p>
      </Card>
    );
  }

  if (!ticket) {
    return (
      <Card>
        <p className="text-sm text-text-2">Ticket not found.</p>
      </Card>
    );
  }

  const closed = ticket.status === 'CLOSED';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h1 className="font-serif text-xl">Ticket</h1>
        <Status variant={STATUS_VARIANT[ticket.status] ?? 'pending'}>{ticket.status.replace('_', ' ')}</Status>
      </div>

      <Card className="mb-4 mt-3">
        <div className="text-[10px] uppercase text-text-2 mb-2">Move to</div>
        <div className="flex gap-2 flex-wrap">
          {ALL_STATUSES.map((s) => (
            <button key={s} onClick={() => transition(s)} disabled={pending || s === ticket.status}>
              <Chip gold={s === ticket.status} className={s === ticket.status ? '' : 'cursor-pointer'}>
                {s.replace('_', ' ')}
              </Chip>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Customer</div>
          <div className="text-xs">{ticket.user?.name ?? '—'}</div>
          <div className="text-xs text-text-2">{ticket.user?.email}</div>
          <div className="text-xs text-text-2">{ticket.user?.phone}</div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Related Order</div>
          {ticket.order ? (
            <Link href={`/orders/${ticket.order.id}`} className="text-xs text-gold-light">
              #{ticket.order.orderNumber}
            </Link>
          ) : (
            <div className="text-xs text-text-2">None</div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-2.5">
        <Card className="bg-surface-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] uppercase text-text-2">Customer · Original Issue</span>
            <span className="text-[10px] text-text-2">{formatDateTime(ticket.createdAt)}</span>
          </div>
          <p className="text-[11.5px]">{ticket.body}</p>
        </Card>
        {ticket.messages.map((m) => (
          <Card key={m.id} className={m.authorRole === 'CUSTOMER' ? 'bg-surface-2' : ''}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] uppercase text-text-2">
                {m.authorName ?? (m.authorRole === 'CUSTOMER' ? 'Customer' : 'Staff')}
              </span>
              <span className="text-[10px] text-text-2">{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="text-[11.5px]">{m.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        {closed ? (
          <p className="text-xs text-text-2">This ticket is closed. Reopen it (move to a different status above) to respond.</p>
        ) : (
          <form onSubmit={sendReply}>
            <div className="text-[10px] uppercase text-text-2 mb-2">Respond</div>
            <textarea
              required
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a response…"
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-20"
            />
            <ButtonGold type="submit" disabled={pending} className="mt-2.5">
              Send Response
            </ButtonGold>
          </form>
        )}
        {error && <p className="text-xs text-danger mt-2.5">{error}</p>}
      </Card>
    </div>
  );
}
