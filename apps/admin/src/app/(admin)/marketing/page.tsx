'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Status, ButtonGold } from '@/components/ui';

interface Coupon {
  id: string;
  code: string;
  type: string;
  usageCount: number;
  isActive: boolean;
}
interface Bundle {
  id: string;
  name: string;
  bundlePriceUgx: number;
}
interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
}
interface NewsletterCampaign {
  id: string;
  subject: string;
  recipientCount: number;
  notifiedUserCount: number;
  sentAt: string;
}

// FR-26: Marketing & Promotions (read side, real). Coupon/bundle creation,
// abandoned-cart campaigns, and A/B testing are follow-up work.
export default function MarketingPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[] | null>(null);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function loadCampaignData() {
    authedFetch('/admin/marketing/newsletter-subscribers').then((r) => (r.ok ? r.json() : [])).then(setSubscribers);
    authedFetch('/admin/marketing/newsletter/campaigns').then((r) => (r.ok ? r.json() : [])).then(setCampaigns);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/marketing/coupons').then((r) => (r.ok ? r.json() : [])).then(setCoupons);
    authedFetch('/admin/marketing/bundles').then((r) => (r.ok ? r.json() : [])).then(setBundles);
    loadCampaignData();
  }, []);

  async function sendNewsletter(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await authedFetch('/admin/marketing/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) {
        setResult('Failed to send newsletter.');
        return;
      }
      const campaign: NewsletterCampaign = await res.json();
      setResult(
        `Sent to ${campaign.recipientCount} subscriber(s) by email, ${campaign.notifiedUserCount} also notified in their account.`,
      );
      setSubject('');
      setBody('');
      loadCampaignData();
    } finally {
      setSending(false);
    }
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">Marketing &amp; Promotions</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Active Coupons</div>
          {!coupons?.length ? (
            <p className="text-sm text-text-2">No coupons yet.</p>
          ) : (
            coupons.map((c) => (
              <div key={c.id} className="flex justify-between items-center py-2 border-b border-[#E3EDDB] text-xs last:border-0">
                <span>{c.code} — {c.type.replace('_', ' ').toLowerCase()}</span>
                <Status variant={c.isActive ? 'ok' : 'pending'}>{c.isActive ? 'Live' : 'Inactive'}</Status>
              </div>
            ))
          )}
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Wellness Kit Bundles</div>
          {!bundles?.length ? (
            <p className="text-sm text-text-2">No bundles yet.</p>
          ) : (
            bundles.map((b) => (
              <div key={b.id} className="text-xs py-1">{b.name}</div>
            ))
          )}
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">
            Newsletter Subscribers{subscribers?.length ? ` (${subscribers.length})` : ''}
          </div>
          {!subscribers?.length ? (
            <p className="text-sm text-text-2">No subscribers yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {subscribers.map((s) => (
                <div key={s.id} className="flex justify-between items-center py-1.5 border-b border-[#E3EDDB] text-xs last:border-0">
                  <span>{s.email}</span>
                  <span className="text-text-2">{new Date(s.subscribedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="sm:col-span-2">
          <div className="text-[10px] uppercase text-text-2 mb-2">Compose Newsletter</div>
          <p className="text-[11px] text-text-2 mb-3">
            Sends by email to every active subscriber, and adds an in-app notification (with a &quot;Follow
            ChrisPa&quot; link) for any subscriber who also has a ChrisPa account.
          </p>
          <form onSubmit={sendNewsletter} className="flex flex-col gap-2.5">
            <input
              required
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
            />
            <textarea
              required
              placeholder="Newsletter body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-28"
            />
            <div className="flex items-center gap-3">
              <ButtonGold type="submit" disabled={sending || !subscribers?.length}>
                {sending ? 'Sending…' : `Send to ${subscribers?.length ?? 0} subscriber(s)`}
              </ButtonGold>
              {result && <span className="text-[11px] text-gold-light">{result}</span>}
            </div>
          </form>

          {!!campaigns?.length && (
            <>
              <div className="text-[10px] uppercase text-text-2 mt-4 mb-2">Past Campaigns</div>
              <div className="max-h-52 overflow-y-auto">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-[#E3EDDB] text-xs last:border-0">
                    <span>{c.subject}</span>
                    <span className="text-text-2">
                      {new Date(c.sentAt).toLocaleDateString()} · {c.recipientCount} sent, {c.notifiedUserCount} in-app
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
