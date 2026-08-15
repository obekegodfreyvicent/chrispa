'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { Card, Chip, Status, ButtonGhost } from '@/components/ui';

interface Delivery {
  id: string;
  status: string;
  assignedAt: string;
  order: {
    orderNumber: string;
    totalUgx: number;
    shippingAddress: { recipient?: string; line1?: string; city?: string };
  };
}

const STATUS_VARIANT: Record<string, 'ok' | 'pending' | 'danger'> = {
  ASSIGNED: 'pending',
  EN_ROUTE_TO_PICKUP: 'pending',
  PICKED_UP: 'pending',
  EN_ROUTE_TO_CUSTOMER: 'pending',
  DELIVERED: 'ok',
  FAILED: 'danger',
};

const ACTIVE = ['ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER'];

// Driver App (per user request, not in the original SRS) — a driver's own
// assigned deliveries, ownership-scoped server-side (see
// MyDeliveriesController), not just role-gated.
export default function MyDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function load() {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch('/driver/deliveries').then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        setDeliveries([]);
        return;
      }
      setForbidden(false);
      return r.ok ? r.json() : [];
    }).then((data) => {
      if (data) setDeliveries(data);
    });
  }

  useRefetchOnFocus(load);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as a driver.
        </p>
      </Card>
    );
  }
  if (!deliveries) return <div className="text-sm text-text-2">Loading…</div>;

  if (forbidden) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          This page is only for driver accounts. You&apos;re logged in with a role that doesn&apos;t have any
          deliveries assigned to it — log in as the driver&apos;s own account to see their deliveries here.
        </p>
      </Card>
    );
  }

  const active = deliveries.filter((d) => ACTIVE.includes(d.status));
  const done = deliveries.filter((d) => !ACTIVE.includes(d.status));

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <h1 className="font-serif text-xl">My Deliveries</h1>
        <ButtonGhost onClick={load}>Refresh</ButtonGhost>
      </div>

      <div className="text-[10px] uppercase text-text-2 mb-2">Active</div>
      {active.length === 0 ? (
        <Card className="mb-4"><p className="text-sm text-text-2">No active deliveries assigned right now.</p></Card>
      ) : (
        <div className="space-y-2.5 mb-4">
          {active.map((d) => (
            <Link key={d.id} href={`/my-deliveries/${d.id}`}>
              <Card className="hover:border-gold-dark transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-semibold">#{d.order.orderNumber}</div>
                    <div className="text-xs text-text-2 mt-0.5">
                      {d.order.shippingAddress?.recipient} — {d.order.shippingAddress?.line1}, {d.order.shippingAddress?.city}
                    </div>
                  </div>
                  <Status variant={STATUS_VARIANT[d.status] ?? 'pending'}>{d.status.replace(/_/g, ' ')}</Status>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="text-[10px] uppercase text-text-2 mb-2">Completed</div>
          <div className="space-y-2.5">
            {done.map((d) => (
              <Link key={d.id} href={`/my-deliveries/${d.id}`}>
                <Card>
                  <div className="flex justify-between items-center">
                    <div className="text-sm">#{d.order.orderNumber}</div>
                    <Chip gold={d.status === 'DELIVERED'}>{d.status.replace(/_/g, ' ')}</Chip>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
