'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { formatDualPrice } from '@/lib/api';
import { Card, ButtonGhost, ButtonOutline } from '@/components/ui';

interface OrderDetail {
  orderNumber: string;
  status: string;
  totalUgx: number;
  deliveryMethod: string;
  deliveryConfirmedAt: string | null;
  delivery: {
    status: string;
    driver: { name: string; phone: string | null };
    currentLat: number | null;
    currentLng: number | null;
    lastLocationAt: string | null;
  } | null;
}

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'A driver has been assigned to your order',
  EN_ROUTE_TO_PICKUP: 'Your driver is heading to pick up your order',
  PICKED_UP: 'Your order has been picked up',
  EN_ROUTE_TO_CUSTOMER: 'Your driver is on the way to you',
  DELIVERED: 'Your order has been delivered',
  FAILED: 'Delivery attempt unsuccessful — our team will be in touch',
};

const EN_ROUTE = ['EN_ROUTE_TO_PICKUP', 'EN_ROUTE_TO_CUSTOMER'];
const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit' });

const STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

// FR-6: Order Tracking — real-time status, carrier tracking, returns
export default function OrderTrackingPage(props: PageProps<'/orders/[id]'>) {
  const { id } = use(props.params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    authedFetch(`/orders/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4 sm:p-6 max-w-3xl mx-auto text-sm text-text-2">Loading order…</div>;

  if (!order) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <p className="text-sm text-text-2">
            Order not found, or <Link href="/login" className="text-gold-light">log in</Link> to view it.
          </p>
        </Card>
      </div>
    );
  }

  const currentStep = STEPS.indexOf(order.status);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-serif text-xl">Order Tracking — #{order.orderNumber}</h1>
        {order.status === 'DELIVERED' && (
          <Link href={`/orders/${id}/invoice`} className="text-[11px] text-gold-light">
            {order.deliveryConfirmedAt ? 'View / Print Receipt →' : 'Confirm Receipt →'}
          </Link>
        )}
      </div>
      <Card>
        <div className="flex justify-between text-center">
          {STEPS.map((step, i) => (
            <div key={step} className="flex-1">
              <div className={`inline-block text-[10px] px-2.5 py-1 rounded-full ${i <= currentStep ? 'text-gold-light border border-gold-dark' : 'bg-surface-2 text-text-2'}`}>
                ●
              </div>
              <div className="text-[10px] text-text-2 mt-1 capitalize">{step.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </Card>
      {order.delivery && (
        <Card className="mt-4">
          <div className="text-[10px] uppercase text-text-2 mb-1">Delivery</div>
          <div className="text-sm">{DELIVERY_STATUS_LABEL[order.delivery.status] ?? order.delivery.status}</div>
          <div className="text-xs text-text-2 mt-1">
            Driver: {order.delivery.driver.name}{order.delivery.driver.phone ? ` · ${order.delivery.driver.phone}` : ''}
          </div>
          {EN_ROUTE.includes(order.delivery.status) && order.delivery.currentLat && order.delivery.currentLng && (
            <div className="text-xs text-text-2 mt-1">
              Last known location{order.delivery.lastLocationAt ? ` (${fmtTime(order.delivery.lastLocationAt)})` : ''} ·{' '}
              <a
                href={mapsUrl(order.delivery.currentLat, order.delivery.currentLng)}
                target="_blank"
                rel="noreferrer"
                className="text-gold-light"
              >
                View on map
              </a>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-1">Total</div>
          <div className="text-sm">{formatDualPrice(order.totalUgx)}</div>
          <div className="border-t border-surface-2 my-4" />
          <div className="flex gap-2">
            <ButtonGhost>Cancel Order</ButtonGhost>
            <ButtonOutline>Request Return / Refund</ButtonOutline>
          </div>
        </Card>
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-1">Delivery Method</div>
          <div className="text-sm capitalize">{order.deliveryMethod.toLowerCase().replace('_', ' ')}</div>
        </Card>
      </div>
    </div>
  );
}
