'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, Status } from '@/components/ui';

interface Order {
  id: string;
  orderNumber: string;
  totalUgx: number;
  status: string;
  items: unknown[];
  user: { name: string } | null;
  warehouse: { name: string } | null;
  deliveryConfirmedAt: string | null;
}

const TABS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED'] as const;
const STATUS_VARIANT: Record<string, 'ok' | 'pending' | 'danger'> = {
  DELIVERED: 'ok',
  SHIPPED: 'ok',
  PROCESSING: 'pending',
  PENDING: 'pending',
  REFUND_REQUESTED: 'danger',
  REFUNDED: 'danger',
  CANCELLED: 'danger',
};

// FR-23: Order Management (real — list/filter/search against /admin/orders)
export default function OrderManagementPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [authed, setAuthed] = useState(true);

  function load() {
    const params = new URLSearchParams();
    if (tab !== 'ALL') params.set('status', tab);
    if (search) params.set('search', search);
    if (confirmedOnly) params.set('confirmed', 'true');
    authedFetch(`/admin/orders?${params}`).then((r) => (r.ok ? r.json() : [])).then(setOrders);
    authedFetch('/admin/orders/counts').then((r) => (r.ok ? r.json() : {})).then(setCounts);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, confirmedOnly]);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Fulfillment staff.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Order Management</h1>
        <input
          placeholder="Search order # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-64"
        />
      </div>
      <div className="flex gap-2 mb-3.5 flex-wrap items-center">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            <Chip gold={tab === t}>
              {t.replace('_', ' ')} ({counts[t] ?? 0})
            </Chip>
          </button>
        ))}
        <span className="w-px h-4 bg-surface-2 mx-1" />
        <button onClick={() => setConfirmedOnly((v) => !v)}>
          <Chip gold={confirmedOnly}>✓ Receipt Confirmed ({counts.CONFIRMED ?? 0})</Chip>
        </button>
      </div>
      <Card className="p-0 overflow-hidden">
        {!orders ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Order</th>
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Items</th>
                <th className="p-2.5">Warehouse</th>
                <th className="p-2.5">Total</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Receipt</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-surface-2">
                  <td className="p-2.5">#{o.orderNumber}</td>
                  <td className="p-2.5">{o.user?.name ?? '—'}</td>
                  <td className="p-2.5">{o.items.length}</td>
                  <td className="p-2.5">{o.warehouse?.name ?? '—'}</td>
                  <td className="p-2.5">UGX {o.totalUgx.toLocaleString()}</td>
                  <td className="p-2.5">
                    <Status variant={STATUS_VARIANT[o.status] ?? 'pending'}>{o.status.replace('_', ' ')}</Status>
                  </td>
                  <td className="p-2.5">
                    {o.deliveryConfirmedAt ? (
                      <Status variant="ok">✓ Confirmed</Status>
                    ) : o.status === 'DELIVERED' ? (
                      <span className="text-text-2">Awaiting confirmation</span>
                    ) : (
                      <span className="text-text-2">—</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <Link href={`/orders/${o.id}`} className="text-gold-light">View</Link>
                  </td>
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
