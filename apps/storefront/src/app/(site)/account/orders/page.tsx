'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { formatDualPrice } from '@/lib/api';
import { Card } from '@/components/ui';

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalUgx: number;
  items: unknown[];
}

// FR-14: Order History & Tracking
export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      setOrders([]);
      return;
    }
    authedFetch('/orders')
      .then((res) => (res.ok ? res.json() : []))
      .then(setOrders);
  }, []);

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Order History &amp; Tracking</h1>
      <Card className="p-0">
        {!orders ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No orders yet.</p>
        ) : (
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Order</th>
                <th className="p-2.5">Items</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-surface-2">
                  <td className="p-2.5">
                    <Link href={`/orders/${order.id}`} className="text-gold-light">
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="p-2.5">{order.items.length}</td>
                  <td className="p-2.5 capitalize">{order.status.toLowerCase()}</td>
                  <td className="p-2.5 whitespace-nowrap">{formatDualPrice(order.totalUgx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
