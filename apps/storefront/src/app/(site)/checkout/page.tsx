'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { formatDualPrice } from '@/lib/api';
import { Card, Chip, ButtonGold } from '@/components/ui';

interface CartItem {
  id: string;
  qty: number;
  product: { priceUgx: number };
  variant?: { priceDelta: number } | null;
}
interface CartResponse {
  items: CartItem[];
}

type DeliveryMethod = 'STANDARD' | 'EXPRESS' | 'SAME_DAY';
type PaymentMethod = 'CASH_ON_DELIVERY' | 'MOBILE_MONEY' | 'CARD';

// Mirrors CheckoutService's DELIVERY_FEES_UGX — used here only to show an
// estimate before the server computes the authoritative total.
const DELIVERY_FEES_UGX: Record<DeliveryMethod, number> = { STANDARD: 0, EXPRESS: 8000, SAME_DAY: 12000 };
const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  STANDARD: 'Standard · Free',
  EXPRESS: 'Express · UGX 8,000',
  SAME_DAY: 'Same-day (Kla) · UGX 12,000',
};

// FR-5: Checkout. Guest checkout (FR-5.2) isn't built — requires login, same
// as Cart. Only Cash on Delivery actually places an order today.
export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);

  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('Kampala');
  const [notes, setNotes] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    authedFetch('/cart')
      .then((res) => (res.ok ? res.json() : null))
      .then(setCart)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-text-2">Loading…</div>;

  if (!signedIn) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Card>
          <p className="text-sm text-text-2">
            <Link href="/login" className="text-gold-light">Log in</Link> to check out.
          </p>
        </Card>
      </div>
    );
  }

  const items = cart?.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + (i.product.priceUgx + (i.variant?.priceDelta ?? 0)) * i.qty, 0);
  const shippingFee = DELIVERY_FEES_UGX[deliveryMethod];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await authedFetch('/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddress: { recipient, phone, line1, city, notes: notes || undefined },
          deliveryMethod,
          paymentMethod,
          couponCode: couponCode || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? 'Could not place your order.'));
        return;
      }
      router.push(`/orders/${body.order.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="font-serif text-xl mb-4">Checkout</h1>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-text-2">
            Your cart is empty. <Link href="/" className="text-gold-light">Continue shopping</Link>.
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-1">Shipping Address</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input required placeholder="Full name" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input required placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
            <input required placeholder="Address" value={line1} onChange={(e) => setLine1(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mt-2.5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
              <input required placeholder="City" value={city} onChange={(e) => setCity(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input placeholder="Delivery notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>

            <div className="border-t border-surface-2 my-4" />
            <div className="text-[10px] uppercase text-text-2 mb-1">Delivery Method</div>
            <div className="flex gap-2.5 flex-wrap">
              {(Object.keys(DELIVERY_LABELS) as DeliveryMethod[]).map((m) => (
                <button type="button" key={m} onClick={() => setDeliveryMethod(m)}>
                  <Chip gold={deliveryMethod === m}>{DELIVERY_LABELS[m]}</Chip>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-2">Order Summary</div>
            <div className="flex justify-between text-[11.5px] mb-1.5">
              <span className="text-text-2">{items.length} items</span>
              <span>{formatDualPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[11.5px] mb-1.5">
              <span className="text-text-2">Shipping</span>
              <span>{shippingFee === 0 ? 'Free' : formatDualPrice(shippingFee)}</span>
            </div>
            <div className="border-t border-surface-2 my-3.5" />
            <div className="flex justify-between text-[15px] mb-3.5">
              <b>Est. Total</b>
              <b className="text-gold-light">{formatDualPrice(subtotal + shippingFee)}</b>
            </div>

            <div className="text-[10px] uppercase text-text-2 mb-1">Promo Code</div>
            <input placeholder="CHRISPA10" value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] mb-3.5" />

            <div className="text-[10px] uppercase text-text-2 mb-1">Payment</div>
            <div className="flex gap-2 flex-wrap mb-3.5">
              <button type="button" onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}>
                <Chip gold={paymentMethod === 'CASH_ON_DELIVERY'}>Cash on Delivery</Chip>
              </button>
              <span title="Not connected to a payment gateway yet">
                <Chip className="opacity-50">Mobile Money (soon)</Chip>
              </span>
              <span title="Not connected to a payment gateway yet">
                <Chip className="opacity-50">Card (soon)</Chip>
              </span>
            </div>

            {error && <p className="text-xs text-danger mb-2.5">{error}</p>}
            <ButtonGold type="submit" disabled={pending} className="w-full">
              {pending ? 'Placing order…' : 'Place Order'}
            </ButtonGold>
          </Card>
        </form>
      )}
    </div>
  );
}
