'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Kpi, Chip, ButtonGhost } from '@/components/ui';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  tier: string;
  _count: { orders: number };
}

// FR-25: Customers (CRM), read side, real. RFM segmentation, tags/notes, and
// campaign-list export are follow-up work.
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [authed, setAuthed] = useState(true);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/admin/customers')
      .then((r) => (r.ok ? r.json() : []))
      .then(setCustomers);
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  const vipCount = customers?.filter((c) => c.tier !== 'STANDARD').length ?? 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h1 className="font-serif text-xl">Customers (CRM)</h1>
        <ButtonGhost onClick={load}>Refresh</ButtonGhost>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Kpi label="Total Customers" value={customers ? String(customers.length) : '—'} />
        <Kpi label="VIP / Gold / Wholesale" value={String(vipCount)} />
      </div>
      <Card className="p-0 overflow-hidden">
        {!customers ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Tier</th>
                <th className="p-2.5">Orders</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-surface-2">
                  <td className="p-2.5">{c.name}</td>
                  <td className="p-2.5">
                    <Chip gold={c.tier !== 'STANDARD'}>{c.tier}</Chip>
                  </td>
                  <td className="p-2.5">{c._count.orders}</td>
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
