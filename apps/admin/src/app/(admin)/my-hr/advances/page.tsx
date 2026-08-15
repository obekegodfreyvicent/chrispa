'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip } from '@/components/ui';

interface Advance {
  id: string;
  principalUgx: number;
  balanceRemainingUgx: number;
  monthlyInstallmentUgx: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
  issuedAt: string;
  note: string | null;
}

function ugx(n: number) {
  return `UGX ${n.toLocaleString()}`;
}

// HR Phase 4 — Self-Service Portal: My Salary Advances (read-only; HR
// creates/cancels advances, an installment is auto-recovered from each
// finalized payslip until the balance reaches zero).
export default function MyAdvancesPage() {
  const [advances, setAdvances] = useState<Advance[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/hr/me/advances').then(async (r) => {
      if (r.status === 404) {
        setNotLinked(true);
        return [];
      }
      return r.ok ? r.json() : [];
    }).then(setAdvances);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return <Card><p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> to view your salary advances.</p></Card>;
  }
  if (notLinked) {
    return <Card><p className="text-sm text-text-2">Your account isn&apos;t linked to an HR employee record — contact HR.</p></Card>;
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-3.5">My Salary Advances</h1>
      <Card className="p-0 overflow-hidden">
        {!advances ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : advances.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No salary advances on record.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Issued</th>
                <th className="p-2.5">Principal</th>
                <th className="p-2.5">Balance Remaining</th>
                <th className="p-2.5">Installment</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((a) => (
                <tr key={a.id} className="border-t border-surface-2">
                  <td className="p-2.5">{new Date(a.issuedAt).toLocaleDateString()}</td>
                  <td className="p-2.5">{ugx(a.principalUgx)}</td>
                  <td className="p-2.5 text-gold-light">{ugx(a.balanceRemainingUgx)}</td>
                  <td className="p-2.5">{ugx(a.monthlyInstallmentUgx)}/mo</td>
                  <td className="p-2.5"><Chip gold={a.status === 'ACTIVE'}>{a.status.replace('_', ' ')}</Chip></td>
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
