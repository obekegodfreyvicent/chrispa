'use client';

import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card } from '@/components/ui';

interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
}
interface Loyalty {
  pointsBalance: number;
  tier: string;
  ledgerEntries: LedgerEntry[];
}

// FR-18: Loyalty Points / Rewards Dashboard. Redemption and earn-rate rules are
// follow-up work — see docs/SRS.md FR-18.2/18.3.
export default function LoyaltyPage() {
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    authedFetch('/loyalty')
      .then((res) => (res.ok ? res.json() : null))
      .then(setLoyalty);
  }, []);

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Loyalty Points / Rewards Dashboard</h1>
      <Card className="text-center bg-gradient-to-br from-surface to-[#EAF3E2]">
        <div className="text-[10px] uppercase text-text-2 mb-1">Current Tier</div>
        <div className="font-serif text-2xl text-gold-light">✦ {loyalty?.tier ?? '—'}</div>
        <div className="text-[10.5px] text-text-2">{loyalty?.pointsBalance ?? 0} pts</div>
      </Card>
      <Card className="mt-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Points History</div>
        {!loyalty?.ledgerEntries.length ? (
          <p className="text-sm text-text-2">No activity yet.</p>
        ) : (
          <ul className="text-[11px] text-text-2 space-y-1">
            {loyalty.ledgerEntries.map((e) => (
              <li key={e.id}>
                {e.delta > 0 ? '+' : ''}
                {e.delta} pts — {e.reason}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
