'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold, Chip } from '@/components/ui';

interface TicketMessage {
  id: string;
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
}

const STATUS_GOLD: Record<string, boolean> = { RESOLVED: true };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// FR-7.4: customer-side ticket thread — read staff responses, reply while open.
export default function TicketDetailPage(props: PageProps<'/support/tickets/[id]'>) {
  const { id } = use(props.params);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function load() {
    authedFetch(`/support/tickets/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setTicket)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await authedFetch(`/support/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? 'Could not send your reply.');
        return;
      }
      setTicket(data);
      setReply('');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="p-4 sm:p-6 max-w-2xl mx-auto text-sm text-text-2">Loading ticket…</div>;

  if (!ticket) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <Card>
          <p className="text-sm text-text-2">
            Ticket not found, or <Link href="/login" className="text-gold-light">log in</Link> to view it.
          </p>
        </Card>
      </div>
    );
  }

  const closed = ticket.status === 'CLOSED';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <Link href="/support" className="text-[11px] text-gold-light">← Back to Support</Link>
        <Chip gold={STATUS_GOLD[ticket.status] ?? false}>{ticket.status.replace('_', ' ')}</Chip>
      </div>
      <h1 className="font-serif text-xl mb-4 mt-2">Ticket</h1>

      <div className="flex flex-col gap-2.5">
        <Card className="bg-surface-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] uppercase text-text-2">You</span>
            <span className="text-[10px] text-text-2">{formatDateTime(ticket.createdAt)}</span>
          </div>
          <p className="text-[11.5px]">{ticket.body}</p>
        </Card>
        {ticket.messages.map((m) => (
          <Card key={m.id} className={m.authorRole === 'CUSTOMER' ? 'bg-surface-2' : ''}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] uppercase text-text-2">
                {m.authorRole === 'CUSTOMER' ? 'You' : (m.authorName ?? 'ChrisPa Support')}
              </span>
              <span className="text-[10px] text-text-2">{formatDateTime(m.createdAt)}</span>
            </div>
            <p className="text-[11.5px]">{m.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        {closed ? (
          <p className="text-xs text-text-2">This ticket is closed. Raise a new ticket for further help.</p>
        ) : (
          <form onSubmit={sendReply}>
            <textarea
              required
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply…"
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-16"
            />
            <ButtonGold type="submit" disabled={sending} className="mt-2.5">
              Send Reply
            </ButtonGold>
            {error && <p className="text-xs text-danger mt-2">{error}</p>}
          </form>
        )}
      </Card>
    </div>
  );
}
