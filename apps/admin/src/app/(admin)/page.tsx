'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Kpi } from '@/components/ui';

// FR-20: Dashboard & Analytics. KPI/sparkline values (Revenue, Orders,
// Conversion, AOV) need a sales-aggregation endpoint that doesn't exist yet —
// only counts that are trivial reads (customers, low-stock SKUs) are real here.
//
// The admin console's default/root page ("/") is this dashboard for a signed-in
// staff member, but redirects straight to /login for anyone who isn't — per
// explicit user decision, so the console's default landing page functions as
// the admin login page rather than showing a dashboard shell with an inline
// "please log in" prompt (every other admin page still uses that inline-prompt
// pattern; this is deliberately only the root's behavior).
export default function DashboardPage() {
  const router = useRouter();
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      router.replace('/login');
      return;
    }
    authedFetch('/admin/customers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCustomerCount(Array.isArray(data) ? data.length : null));
    authedFetch('/admin/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) =>
        setLowStockCount(Array.isArray(data) ? data.filter((r: { qtyOnHand: number; reorderPoint: number }) => r.qtyOnHand <= r.reorderPoint).length : null),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    // Redirecting via the effect above — render nothing rather than a flash
    // of dashboard chrome (or a stale inline "log in" prompt) before it fires.
    return null;
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-1">Dashboard &amp; Analytics</h1>
      <p className="text-xs text-text-2 mb-4">
        Revenue, order-volume, and conversion KPIs need a sales-aggregation endpoint — follow-up work.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Customers" value={customerCount === null ? '—' : String(customerCount)} />
        <Kpi label="Low Stock Alerts" value={lowStockCount === null ? '—' : String(lowStockCount)} />
        <Kpi label="Revenue (30d)" value="—" delta="not yet tracked" />
        <Kpi label="Orders" value="—" delta="not yet tracked" />
      </div>
    </div>
  );
}
