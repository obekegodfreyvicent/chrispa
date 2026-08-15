'use client';

import { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// FR-1.6/FR-26.4: footer newsletter signup — a small client island inside
// the otherwise-server-rendered SiteFooter (see site-footer.tsx). Public,
// unauthenticated POST /newsletter/subscribe; always reports success on a
// 200 without revealing whether the email was already subscribed (see
// MarketingService.subscribeNewsletter()'s idempotent-either-way behavior).
export function NewsletterSignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('pending');
    try {
      const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="w-full sm:w-auto">
        <div className="text-[10px] uppercase tracking-wide text-text-2 mb-1">Newsletter</div>
        <p className="text-[11.5px] text-gold-light w-full sm:w-56">Subscribed — thank you!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full sm:w-auto">
      <label htmlFor="newsletter-email" className="text-[10px] uppercase tracking-wide text-text-2 mb-1 block">
        Newsletter
      </label>
      <div className="flex gap-1.5">
        <input
          id="newsletter-email"
          required
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-full sm:w-56"
        />
        <button
          type="submit"
          disabled={status === 'pending'}
          className="shrink-0 px-3 py-2 rounded-md text-[11.5px] font-semibold bg-gold text-white disabled:opacity-50"
        >
          {status === 'pending' ? '…' : 'Join'}
        </button>
      </div>
      {status === 'error' && <p className="text-[10.5px] text-danger mt-1">Something went wrong — try again.</p>}
    </form>
  );
}
