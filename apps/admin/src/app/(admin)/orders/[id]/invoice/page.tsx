'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold } from '@/components/ui';

interface InvoiceItem {
  id: string;
  qty: number;
  unitPriceUgx: number;
  product: { name: string; sku: string };
  variant: { size: string } | null;
}
interface InvoiceOrder {
  orderNumber: string;
  createdAt: string;
  subtotalUgx: number;
  shippingFeeUgx: number;
  discountUgx: number;
  vatUgx: number;
  totalUgx: number;
  paymentMethod: string | null;
  shippingAddress: { recipient?: string; phone?: string; line1?: string; city?: string };
  items: InvoiceItem[];
  deliveryConfirmedAt: string | null;
  delivery: {
    status: string;
    driver: { name: string; phone: string | null };
    pickedUpAt: string | null;
    pickupLat: number | null;
    pickupLng: number | null;
    deliveredAt: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
  } | null;
}

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

// Mirrors apps/storefront/src/lib/api.ts's formatDualPrice() exactly — same
// static, manually-set rate — so a staff member's copy of an invoice never
// shows a different total than the customer's copy of the same order. Two
// separate files (no shared package between the apps, per this repo's
// convention), but they must stay numerically identical; if the rate here
// ever changes, change it in both places.
const USD_PER_UGX = 1 / 3800;
const fmt = (n: number) =>
  `UGX ${n.toLocaleString()} (~$${(n * USD_PER_UGX).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });

// Same brand mark as the storefront's invoice / SiteHeader / the HR Staff
// ID card — no separate image asset exists.
function ChrisPaLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-11 h-11 shrink-0">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#1B5E20" strokeWidth="3" />
      <text x="50" y="63" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="46" fill="#3F7D32">
        C
      </text>
    </svg>
  );
}

// Mirrors the storefront's own stamp exactly — staff should see the same
// customer-confirmation record on their copy of the invoice.
function ReceivedStamp({ confirmedAt }: { confirmedAt: string }) {
  return (
    <div
      className="absolute select-none pointer-events-none"
      style={{ top: 150, right: 24, transform: 'rotate(-12deg)', opacity: 0.8 }}
    >
      <div
        className="rounded-full flex flex-col items-center justify-center text-center"
        style={{ width: 138, height: 138, border: '3px double #1B5E20', color: '#1B5E20' }}
      >
        <div className="text-[8.5px] font-bold tracking-[0.15em] mt-2.5">CHRISPA</div>
        <div className="text-[20px] leading-none my-0.5">✓</div>
        <div className="text-[8px] font-semibold leading-tight px-3">
          RECEIVED IN
          <br />
          GOOD CONDITION
        </div>
        <div className="text-[6.5px] mt-1.5">{fmtDate(confirmedAt)}</div>
      </div>
    </div>
  );
}

// PAY-FR-5 (Automated Invoicing, docs/SRS.md §21): a printable invoice
// built entirely from data GET /admin/orders/:id already returns — same
// "pure frontend feature, browser print, no PDF-generation library or
// email-sending" pattern HR's Staff ID card already established. There is
// no email delivery (no provider connected, same constraint as everywhere
// else in this codebase) — "sent" means the buyer can view/print/save-as-
// PDF this page themselves.
export default function AdminInvoicePage(props: PageProps<'/orders/[id]/invoice'>) {
  const { id } = use(props.params);
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    authedFetch(`/admin/orders/${id}`).then((r) => (r.ok ? r.json() : null)).then(setOrder);
  }, [id]);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner, Store Manager, or Fulfillment staff.
        </p>
      </Card>
    );
  }
  if (!order) return <p className="text-sm text-text-2">Loading…</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Link href={`/orders/${id}`} className="text-[11px] text-gold-light">← Back to order</Link>
        <ButtonGold onClick={() => window.print()}>Print / Save as PDF</ButtonGold>
      </div>

      <div id="invoice" className="relative bg-white text-black p-8 mx-auto" style={{ maxWidth: '720px' }}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <ChrisPaLogo />
            <div>
              <div className="font-serif italic text-xl" style={{ color: '#3F7D32' }}>ChrisPa Scents and Soaps LTD</div>
              <div className="text-[10px] text-gray-500">Natural Wellness — Candles · Sea Salts · Ghee · Honey · Soap</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold uppercase tracking-wide">Receipt</div>
            <div className="text-[11px] text-gray-500">#{order.orderNumber}</div>
            <div className="text-[11px] text-gray-500">{fmtDate(order.createdAt)}</div>
          </div>
        </div>

        <div className="mb-6 text-[10.5px] text-gray-500 border-y border-gray-200 py-2.5">
          Kampala Industrial &amp; Business Park, Namanve, Kampala, Uganda &nbsp;·&nbsp; +256 700 123 456
          &nbsp;·&nbsp; hello@chrispa.ug &nbsp;·&nbsp; chrispa.ug
        </div>

        <div className="mb-8 text-[12px]">
          <div className="text-[10px] uppercase text-gray-400 mb-1">Ship To</div>
          <div>{order.shippingAddress?.recipient}</div>
          <div className="text-gray-500">{order.shippingAddress?.line1}, {order.shippingAddress?.city}</div>
          <div className="text-gray-500">{order.shippingAddress?.phone}</div>
        </div>

        <table className="w-full text-[12px] mb-6">
          <thead>
            <tr className="text-left border-b border-gray-300 text-gray-500 text-[10px] uppercase">
              <th className="pb-2">Item</th>
              <th className="pb-2">SKU</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">{item.product.name}{item.variant ? ` · ${item.variant.size}` : ''}</td>
                <td className="py-2 text-gray-500">{item.product.sku}</td>
                <td className="py-2 text-right whitespace-nowrap">{item.qty}</td>
                <td className="py-2 text-right whitespace-nowrap">{fmt(item.unitPriceUgx)}</td>
                <td className="py-2 text-right whitespace-nowrap">{fmt(item.unitPriceUgx * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-80 text-[12px] space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(order.subtotalUgx)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{fmt(order.shippingFeeUgx)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>− {fmt(order.discountUgx)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">VAT (18%)</span><span>{fmt(order.vatUgx)}</span></div>
            <div className="flex justify-between font-semibold text-[14px] pt-2 border-t border-gray-300">
              <span>Total</span><span>{fmt(order.totalUgx)}</span>
            </div>
            <div className="text-gray-500 text-[10px] pt-1">Payment method: {order.paymentMethod?.replace(/_/g, ' ') ?? '—'}</div>
          </div>
        </div>

        {order.delivery && (
          <div className="mb-8 text-[11px] border-t border-gray-200 pt-4">
            <div className="text-[10px] uppercase text-gray-400 mb-1.5">Delivery</div>
            <div className="text-gray-700">
              Driver: {order.delivery.driver.name}{order.delivery.driver.phone ? ` (${order.delivery.driver.phone})` : ''}
            </div>
            {order.delivery.pickedUpAt && (
              <div className="text-gray-500">
                Picked up: {fmtDateTime(order.delivery.pickedUpAt)}
                {order.delivery.pickupLat && order.delivery.pickupLng && (
                  <> — <a href={mapsUrl(order.delivery.pickupLat, order.delivery.pickupLng)} target="_blank" rel="noreferrer" className="underline">GPS location</a></>
                )}
              </div>
            )}
            {order.delivery.deliveredAt && (
              <div className="text-gray-500">
                Delivered: {fmtDateTime(order.delivery.deliveredAt)}
                {order.delivery.deliveryLat && order.delivery.deliveryLng && (
                  <> — <a href={mapsUrl(order.delivery.deliveryLat, order.delivery.deliveryLng)} target="_blank" rel="noreferrer" className="underline">GPS location</a></>
                )}
              </div>
            )}
          </div>
        )}

        {order.deliveryConfirmedAt && <ReceivedStamp confirmedAt={order.deliveryConfirmedAt} />}

        <div className="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-4">
          {order.deliveryConfirmedAt ? (
            <>
              Thank you for shopping with ChrisPa Scents and Soaps LTD — goods received in good condition,
              confirmed by customer on {fmtDate(order.deliveryConfirmedAt)}.
            </>
          ) : (
            <>Thank you for shopping with ChrisPa Scents and Soaps LTD — customer has not yet confirmed receipt.</>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice, #invoice * { visibility: visible; }
          #invoice { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
