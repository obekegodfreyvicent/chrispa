'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, ButtonGold } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING =
  "Hi, I'm ChrisPa Agent 👋 Ask me about our candles, sea salts, ghee, honey, or soap bars — or about shipping, returns, candle safety, or ingredients.";

// FR-7.1 (docs/SRS.md §5.1): the storefront's "ChrisPa Agent" — named and
// given an avatar per explicit user request (the wireframe's original
// placeholder name for this feature was "Pa"). Backed by a basic,
// keyword-matched FAQ bot (no external API, no cost, no credentials — a
// deliberate downgrade from an earlier Claude-API-backed version, per
// explicit user decision) — see chat.service.ts. Chat is also deliberately
// ephemeral (no persistence, separately decided): the conversation lives
// only in this component's state and resets on reload.
export function AiChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || pending) return;

    setError(null);
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: message }];
    setTurns(nextTurns);
    setInput('');
    setPending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError('ChrisPa Agent is taking a break right now — please try again shortly, or use the "Submit a Ticket" card.');
        return;
      }
      setTurns([...nextTurns, { role: 'assistant', content: body.reply }]);
    } catch {
      setError("Couldn't reach ChrisPa Agent — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col h-[420px] sm:h-[480px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AgentAvatar className="w-8 h-8" />
          <div>
            <div className="text-[10px] uppercase text-text-2">Live Chat</div>
            <div className="text-xs font-semibold">ChrisPa Agent</div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-text-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          Online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
        <ChatBubble role="assistant">{GREETING}</ChatBubble>
        {turns.map((turn, i) => (
          <ChatBubble key={i} role={turn.role}>
            {turn.content}
          </ChatBubble>
        ))}
        {pending && <ChatBubble role="assistant">ChrisPa Agent is typing…</ChatBubble>}
        {error && <p className="text-[11px] text-danger">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 mt-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask ChrisPa Agent a question…"
          aria-label="Message to ChrisPa Agent"
          className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
        />
        <ButtonGold type="submit" disabled={pending || !input.trim()} className="shrink-0">
          Send
        </ButtonGold>
      </form>
    </Card>
  );
}

// Deliberately echoes the header logo's mark (site-header.tsx) — same green
// stroke/fill hex values and serif-italic lettering — so the assistant
// reads as a ChrisPa-branded persona rather than a generic chat-bot icon.
function AgentAvatar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${className}`} role="img" aria-label="ChrisPa Agent avatar">
      <circle cx="50" cy="50" r="46" fill="#F7FAF4" stroke="#1B5E20" strokeWidth="4" />
      <text x="50" y="61" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="34" fill="#3F7D32">
        CA
      </text>
    </svg>
  );
}

function ChatBubble({ role, children }: { role: 'user' | 'assistant'; children: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex items-end gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <AgentAvatar className="w-5 h-5" />}
      <div
        className={`max-w-[80%] rounded-md px-2.5 py-1.5 text-[11.5px] whitespace-pre-wrap ${
          isUser ? 'bg-gold text-white' : 'bg-surface-2 text-foreground'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
