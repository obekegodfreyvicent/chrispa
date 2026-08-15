'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, Status, ButtonGold, ButtonOutline, ButtonDanger } from '@/components/ui';

interface OrderItem {
  id: string;
  qty: number;
  product: { name: string };
  variant: { size: string } | null;
}
interface Delivery {
  id: string;
  status: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickedUpAt: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveredAt: string | null;
  currentLat: number | null;
  currentLng: number | null;
  order: {
    orderNumber: string;
    totalUgx: number;
    paymentMethod: string | null;
    shippingAddress: { recipient?: string; phone?: string; line1?: string; city?: string; notes?: string };
    items: OrderItem[];
    warehouse: { name: string; location: string } | null;
    user: { name: string; phone: string | null } | null;
  };
}

// Which button to show next, and the label/status it advances to — mirrors
// DeliveryService's ALLOWED_DELIVERY_TRANSITIONS exactly (the server is
// still the real gate; this just avoids showing a button that would 400).
const NEXT_STEP: Record<string, { status: string; label: string; needsGps: boolean } | null> = {
  ASSIGNED: { status: 'EN_ROUTE_TO_PICKUP', label: "I'm heading to pick up this order", needsGps: false },
  EN_ROUTE_TO_PICKUP: { status: 'PICKED_UP', label: "I've picked up the order", needsGps: true },
  PICKED_UP: { status: 'EN_ROUTE_TO_CUSTOMER', label: "I'm heading to the customer", needsGps: false },
  EN_ROUTE_TO_CUSTOMER: { status: 'DELIVERED', label: "I've delivered the order", needsGps: true },
  DELIVERED: null,
  FAILED: null,
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function mapsUrlForAddress(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

// Captures the browser's current position (per user decision: deep-link out
// to Google Maps for actual navigation rather than an in-app map/SDK) —
// rejects with a clear message on denial/timeout rather than leaving the
// caller hanging on a browser API that has no built-in error UI of its own.
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device/browser does not support location sharing.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(err.message)), {
      enableHighAccuracy: true,
      timeout: 15000,
    });
  });
}

export default function MyDeliveryDetailPage(props: PageProps<'/my-deliveries/[id]'>) {
  const { id } = use(props.params);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);

  function load() {
    authedFetch(`/driver/deliveries/${id}`)
      .then((r) => {
        if (r.status === 403) {
          setLoadError("This page is only for driver accounts — log in as the driver's own account to see this delivery.");
          return null;
        }
        if (!r.ok) {
          setLoadError('Delivery not found.');
          return null;
        }
        setLoadError(null);
        return r.json();
      })
      .then(setDelivery)
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

  async function advance() {
    const next = delivery && NEXT_STEP[delivery.status];
    if (!next) return;
    setError(null);
    setPending(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (next.needsGps) {
        try {
          const pos = await getCurrentPosition();
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not get your location — location access is required to confirm this step.');
          return;
        }
      }
      const res = await authedFetch(`/driver/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.status, lat, lng }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not update this delivery.');
        return;
      }
      setDelivery(body);
    } finally {
      setPending(false);
    }
  }

  async function shareLocation() {
    setError(null);
    setSharingLocation(true);
    try {
      const pos = await getCurrentPosition();
      const res = await authedFetch(`/driver/deliveries/${id}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });
      if (res.ok) setDelivery(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share your location.');
    } finally {
      setSharingLocation(false);
    }
  }

  async function markFailed() {
    if (!window.confirm('Mark this delivery as failed? Use this if you could not complete it (customer unreachable, refused, etc.).')) return;
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch(`/driver/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FAILED' }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? 'Could not update this delivery.');
        return;
      }
      setDelivery(body);
    } finally {
      setPending(false);
    }
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2"><Link href="/login" className="text-gold-light">Log in</Link> as a driver.</p>
      </Card>
    );
  }
  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (loadError) {
    return (
      <Card>
        <p className="text-sm text-text-2">{loadError}</p>
      </Card>
    );
  }
  if (!delivery) return <div className="text-sm text-text-2">Loading…</div>;

  const { order } = delivery;
  const next = NEXT_STEP[delivery.status];
  const destinationAddress = `${order.shippingAddress?.line1 ?? ''}, ${order.shippingAddress?.city ?? ''}`;

  return (
    <div className="max-w-lg">
      <Link href="/my-deliveries" className="text-[11px] text-gold-light">← My Deliveries</Link>
      <div className="flex justify-between items-center mt-1 mb-4">
        <h1 className="font-serif text-xl">Order #{order.orderNumber}</h1>
        <Status variant={delivery.status === 'DELIVERED' ? 'ok' : delivery.status === 'FAILED' ? 'danger' : 'pending'}>
          {delivery.status.replace(/_/g, ' ')}
        </Status>
      </div>

      <Card className="mb-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Pickup</div>
        <div className="text-sm">{order.warehouse?.name ?? '—'}</div>
        <div className="text-xs text-text-2 mb-2">{order.warehouse?.location ?? '—'}</div>
        {order.warehouse && (
          <a href={mapsUrlForAddress(order.warehouse.location)} target="_blank" rel="noreferrer" className="text-[11px] text-gold-light">
            Open pickup location in Google Maps →
          </a>
        )}
        {delivery.pickedUpAt && (
          <div className="text-[10px] text-text-2 mt-2">
            Picked up {fmtTime(delivery.pickedUpAt)}
            {delivery.pickupLat && delivery.pickupLng && (
              <> · <a href={mapsUrl(delivery.pickupLat, delivery.pickupLng)} target="_blank" rel="noreferrer" className="text-gold-light">view on map</a></>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="text-[10px] uppercase text-text-2 mb-2">Deliver To</div>
        <div className="text-sm">{order.shippingAddress?.recipient}</div>
        <div className="text-xs text-text-2">{destinationAddress}</div>
        <div className="text-xs text-text-2 mb-2">{order.shippingAddress?.phone}</div>
        {order.shippingAddress?.notes && <div className="text-xs text-text-2 mb-2">Note: {order.shippingAddress.notes}</div>}
        <a href={mapsUrlForAddress(destinationAddress)} target="_blank" rel="noreferrer" className="text-[11px] text-gold-light">
          Open delivery destination in Google Maps →
        </a>
        {delivery.deliveredAt && (
          <div className="text-[10px] text-text-2 mt-2">
            Delivered {fmtTime(delivery.deliveredAt)}
            {delivery.deliveryLat && delivery.deliveryLng && (
              <> · <a href={mapsUrl(delivery.deliveryLat, delivery.deliveryLng)} target="_blank" rel="noreferrer" className="text-gold-light">view on map</a></>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-0 overflow-hidden">
        <table className="w-full text-[11.5px]">
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-surface-2 first:border-t-0">
                <td className="p-2.5">{item.product.name}{item.variant ? ` · ${item.variant.size}` : ''}</td>
                <td className="p-2.5 text-right text-text-2">× {item.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-surface-2 p-2.5 flex justify-between text-xs">
          <span className="text-text-2">{order.paymentMethod?.replace(/_/g, ' ') ?? '—'}</span>
          <b>UGX {order.totalUgx.toLocaleString()}</b>
        </div>
      </Card>

      {error && <p className="text-xs text-danger mb-2.5">{error}</p>}

      {next && (
        <ButtonGold className="w-full mb-2.5" disabled={pending} onClick={advance}>
          {pending ? 'Updating…' : next.label}
        </ButtonGold>
      )}
      {(delivery.status === 'EN_ROUTE_TO_PICKUP' || delivery.status === 'EN_ROUTE_TO_CUSTOMER') && (
        <ButtonOutline className="w-full mb-2.5" disabled={sharingLocation} onClick={shareLocation}>
          {sharingLocation ? 'Sharing…' : 'Share my current location'}
        </ButtonOutline>
      )}
      {next && (
        <ButtonDanger className="w-full" disabled={pending} onClick={markFailed}>
          Report a problem / mark as failed
        </ButtonDanger>
      )}
    </div>
  );
}
