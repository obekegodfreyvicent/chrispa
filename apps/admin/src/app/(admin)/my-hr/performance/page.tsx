'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonGold } from '@/components/ui';

interface Goal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
  targetDate: string | null;
}
interface Feedback {
  id: string;
  note: string;
  createdAt: string;
  givenBy: { name: string };
}
interface Review {
  id: string;
  periodStart: string;
  periodEnd: string;
  rating: number | null;
  strengths: string | null;
  areasForImprovement: string | null;
  overallComments: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';
}
interface PerformanceData {
  goals: Goal[];
  feedback: Feedback[];
  reviews: Review[];
}

const GOAL_STATUS_VARIANT = { NOT_STARTED: 'pending', IN_PROGRESS: 'pending', COMPLETED: 'ok', MISSED: 'danger' } as const;

// HR Phase 3 — Self-Service Portal: My Performance
export default function MyPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/performance').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return null;
      }
      return r.ok ? r.json() : null;
    }).then(setData);
  }

  useRefetchOnFocus(load);

  async function acknowledge(id: string) {
    await authedFetch(`/hr/me/reviews/${id}/acknowledge`, { method: 'POST' });
    load();
  }

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to view your performance.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }
  if (!data) return <p className="text-sm text-text-2">Loading…</p>;

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">My Performance</h1>

      <Card className="mb-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Goals</div>
        {data.goals.length === 0 ? <p className="text-sm text-text-2">No goals set yet.</p> : (
          <ul className="space-y-2">
            {data.goals.map((g) => (
              <li key={g.id} className="text-[11.5px] border-b border-surface-2 pb-2 last:border-0">
                <div className="flex justify-between">
                  <span>{g.title}</span>
                  <Status variant={GOAL_STATUS_VARIANT[g.status as keyof typeof GOAL_STATUS_VARIANT] ?? 'pending'}>{g.status.replace('_', ' ')}</Status>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#CBDCC1', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${g.progressPercent}%`, height: '100%', background: 'var(--color-gold)' }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Feedback</div>
        {data.feedback.length === 0 ? <p className="text-sm text-text-2">No feedback yet.</p> : (
          <ul className="space-y-2">
            {data.feedback.map((f) => (
              <li key={f.id} className="text-[11.5px] border-b border-surface-2 pb-2 last:border-0">
                <p>&ldquo;{f.note}&rdquo;</p>
                <div className="text-[10px] text-text-2">— {f.givenBy.name}, {new Date(f.createdAt).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="text-[10px] uppercase text-text-2 mb-2">Reviews</div>
        {data.reviews.length === 0 ? <p className="text-sm text-text-2">No reviews yet.</p> : (
          <ul className="space-y-3">
            {data.reviews.map((r) => (
              <li key={r.id} className="text-[11.5px] border-b border-surface-2 pb-3 last:border-0">
                <div className="flex justify-between items-center">
                  <span>{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {r.rating && <Chip gold>{r.rating}/5</Chip>}
                    <Status variant={r.status === 'ACKNOWLEDGED' ? 'ok' : r.status === 'SUBMITTED' ? 'pending' : 'pending'}>{r.status}</Status>
                  </div>
                </div>
                {r.status !== 'DRAFT' && (
                  <div className="mt-2 space-y-1 text-text-2">
                    {r.strengths && <div><b className="text-foreground">Strengths:</b> {r.strengths}</div>}
                    {r.areasForImprovement && <div><b className="text-foreground">Areas for improvement:</b> {r.areasForImprovement}</div>}
                    {r.overallComments && <div><b className="text-foreground">Comments:</b> {r.overallComments}</div>}
                  </div>
                )}
                {r.status === 'SUBMITTED' && (
                  <ButtonGold className="mt-2" onClick={() => acknowledge(r.id)}>Acknowledge</ButtonGold>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
