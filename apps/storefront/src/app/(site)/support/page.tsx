'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold, Chip } from '@/components/ui';
import { AiChatWidget } from '@/components/ai-chat-widget';

interface TicketSummary {
  id: string;
  body: string;
  status: string;
  orderId: string | null;
  createdAt: string;
  _count: { messages: number };
}

const STATUS_GOLD: Record<string, boolean> = { RESOLVED: true, CLOSED: false };

// FR-7: Help & Support — live chat (real, ChrisPa Agent), FAQ (follow-up work),
// ticket submission + own-ticket history/thread (real, FR-7.3/FR-7.4)
export default function SupportPage() {
  const [body, setBody] = useState('');
  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);

  function loadTickets() {
    if (!getAccessToken()) return;
    authedFetch('/support/tickets')
      .then((res) => (res.ok ? res.json() : []))
      .then(setTickets);
  }

  useEffect(loadTickets, []);

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!getAccessToken()) {
      setStatus('error');
      return;
    }
    const res = await authedFetch('/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, orderId: orderId || undefined }),
    });
    setStatus(res.ok ? 'sent' : 'error');
    if (res.ok) {
      setBody('');
      setOrderId('');
      loadTickets();
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <AiChatWidget />

      <div className="flex flex-col gap-4">
        <Card id="faq">
          <div className="text-[10px] uppercase text-text-2 mb-1">FAQ / Knowledge Base</div>
          <small className="text-[10px] text-text-2">
            Shipping to Kampala · Candle safety · Returns policy · Ingredient sourcing — coming soon. Ask
            ChrisPa Agent in Live Chat for any of these in the meantime.
          </small>
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-1">Raise a Ticket</div>
          {status === 'error' && !getAccessToken() ? (
            <p className="text-xs text-text-2 mt-2">
              <Link href="/login" className="text-gold-light">Log in</Link> to submit a ticket.
            </p>
          ) : (
            <form onSubmit={submitTicket}>
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Order # (optional)"
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mt-2"
              />
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your issue…"
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-16 mt-2"
              />
              <ButtonGold type="submit" className="w-full mt-2.5">
                Submit Ticket
              </ButtonGold>
              {status === 'sent' && <p className="text-xs text-gold-light mt-2">Ticket submitted.</p>}
            </form>
          )}
        </Card>

        {getAccessToken() && (
          <Card className="p-0 overflow-hidden">
            <div className="text-[10px] uppercase text-text-2 p-4 pb-0">My Tickets</div>
            {!tickets ? (
              <p className="text-xs text-text-2 p-4">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-text-2 p-4">No tickets yet.</p>
            ) : (
              <div className="flex flex-col">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/support/tickets/${t.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-surface-2 hover:bg-surface-2"
                  >
                    <span className="text-[11px] truncate">{t.body}</span>
                    <Chip gold={STATUS_GOLD[t.status] ?? false} className="shrink-0">
                      {t.status.replace('_', ' ')}
                    </Chip>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
