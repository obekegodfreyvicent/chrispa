'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Chip, Status } from '@/components/ui';

interface OrderItem {
  id: string;
  qty: number;
  unitPriceUgx: number;
  product: { name: string };
  variant: { size: string } | null;
}
interface OrderDetail {
  orderNumber: string;
  status: string;
  subtotalUgx: number;
  shippingFeeUgx: number;
  discountUgx: number;
  vatUgx: number;
  totalUgx: number;
  deliveryMethod: string;
  paymentMethod: string | null;
  shippingAddress: { recipient?: string; phone?: string; line1?: string; city?: string; notes?: string };
  items: OrderItem[];
  user: { name: string; email: string | null; phone: string | null } | null;
  warehouse: { name: string } | null;
  deliveryConfirmedAt: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });

const ALL_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED'];
const STATUS_VARIANT: Record<string, 'ok' | 'pending' | 'danger'> = {
  DELIVERED: 'ok',
  SHIPPED: 'ok',
  PROCESSING: 'pending',
  PENDING: 'pending',
  REFUND_REQUESTED: 'danger',
  REFUNDED: 'danger',
  CANCELLED: 'danger',
};

// FR-23: Order detail — status-pipeline control (real). Editing items/address/
// pricing, internal notes, split shipment, packing slips, and shipping
// labels are still follow-up work.
export default function AdminOrderDetailPage(props: PageProps<'/orders/[id]'>) {
  const { id } = use(props.params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function load() {
    authedFetch(`/admin/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setOrder)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function transition(status: string) {
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not update order status.');
        return;
      }
      setOrder(body);
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Fulfillment staff.
        </p>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card>
        <p className="text-sm text-text-2">Order not found.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h1 className="font-serif text-xl">Order #{order.orderNumber}</h1>
        <Link href={`/orders/${id}/invoice`} className="text-[11px] text-gold-light">View / Print Receipt →</Link>
      </div>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Status variant={STATUS_VARIANT[order.status] ?? 'pending'}>{order.status.replace('_', ' ')}</Status>
        {order.deliveryConfirmedAt ? (
          <Status variant="ok">✓ Receipt confirmed by customer on {fmtDate(order.deliveryConfirmedAt)}</Status>
        ) : order.status === 'DELIVERED' ? (
          <span className="text-[11px] text-text-2">Customer hasn&apos;t confirmed receipt yet</span>
        ) : null}
      </div>

      <Card className="mb-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Move to</div>
        <div className="flex gap-2 flex-wrap">
          {ALL_STATUSES.map((s) => (
            <button key={s} onClick={() => transition(s)} disabled={pending || s === order.status}>
              <Chip gold={s === order.status} className={s === order.status ? '' : 'cursor-pointer'}>
                {s.replace('_', ' ')}
              </Chip>
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-danger mt-2.5">{error}</p>}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Customer</div>
          <div className="text-xs">{order.user?.name ?? 'Guest'}</div>
          <div className="text-xs text-text-2">{order.user?.email}</div>
          <div className="border-t border-surface-2 my-3" />
          <div className="text-[10px] uppercase text-text-2 mb-2">Shipping Address</div>
          <div className="text-xs">{order.shippingAddress?.recipient}</div>
          <div className="text-xs text-text-2">
            {order.shippingAddress?.line1}, {order.shippingAddress?.city}
          </div>
          <div className="text-xs text-text-2">{order.shippingAddress?.phone}</div>
          {order.shippingAddress?.notes && <div className="text-xs text-text-2 mt-1">Note: {order.shippingAddress.notes}</div>}
        </Card>

        <Card>
          <div className="text-[10px] uppercase text-text-2 mb-2">Fulfillment</div>
          <div className="text-xs">Warehouse: {order.warehouse?.name ?? '—'}</div>
          <div className="text-xs">Delivery: {order.deliveryMethod.replace('_', ' ')}</div>
          <div className="text-xs">Payment: {order.paymentMethod?.replace(/_/g, ' ') ?? '—'}</div>
          <div className="border-t border-surface-2 my-3" />
          <div className="flex justify-between text-xs mb-1"><span className="text-text-2">Subtotal</span><span>UGX {order.subtotalUgx.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs mb-1"><span className="text-text-2">Shipping</span><span>UGX {order.shippingFeeUgx.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs mb-1"><span className="text-text-2">Discount</span><span>− UGX {order.discountUgx.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs mb-1"><span className="text-text-2">VAT (18%)</span><span>UGX {order.vatUgx.toLocaleString()}</span></div>
          <div className="flex justify-between text-sm font-semibold mt-2"><span>Total</span><span className="text-gold-light">UGX {order.totalUgx.toLocaleString()}</span></div>
        </Card>
      </div>

      <Card className="mt-4 p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left text-gold-dark text-[10px] uppercase">
              <th className="p-2.5">Item</th>
              <th className="p-2.5">Qty</th>
              <th className="p-2.5">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-surface-2">
                <td className="p-2.5">{item.product.name}{item.variant ? ` · ${item.variant.size}` : ''}</td>
                <td className="p-2.5">{item.qty}</td>
                <td className="p-2.5">UGX {item.unitPriceUgx.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
