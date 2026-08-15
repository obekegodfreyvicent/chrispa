'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { formatDualPrice } from '@/lib/api';
import { Card, ButtonGold, PlaceholderImage } from '@/components/ui';

interface VariantOption {
  id: string;
  size: string;
  priceDelta: number;
  stockQty: number;
}
interface CartItem {
  id: string;
  qty: number;
  variantId: string | null;
  variant: VariantOption | null;
  product: { name: string; priceUgx: number; variants: VariantOption[] };
}
interface CartResponse {
  items: CartItem[];
}

function unitPrice(item: CartItem) {
  return item.product.priceUgx + (item.variant?.priceDelta ?? 0);
}

// FR-4: Cart — line items, promo, persistent cart across devices
export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function load() {
    return authedFetch('/cart')
      .then((res) => (res.ok ? res.json() : null))
      .then(setCart);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
  }, []);

  async function updateQty(itemId: string, qty: number) {
    if (qty < 1) return;
    setPendingId(itemId);
    try {
      await authedFetch(`/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty }),
      });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  async function removeItem(itemId: string) {
    setPendingId(itemId);
    try {
      await authedFetch(`/cart/items/${itemId}`, { method: 'DELETE' });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  async function changeVariant(itemId: string, variantId: string) {
    setPendingId(itemId);
    try {
      await authedFetch(`/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-text-2">Loading cart…</div>;

  if (!signedIn) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Card>
          <p className="text-sm text-text-2">
            <Link href="/login" className="text-gold-light">Log in</Link> to view your cart.
          </p>
        </Card>
      </div>
    );
  }

  const items = cart?.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + unitPrice(i) * i.qty, 0);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="font-serif text-xl mb-4">Shopping Cart</h1>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
        <Card>
          <b className="text-xs">{items.length} items</b>
          {items.length === 0 ? (
            <p className="text-sm text-text-2 mt-3">
              Your cart is empty. <Link href="/" className="text-gold-light">Continue shopping</Link>.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-3.5 border-b border-[#E3EDDB]">
                <div className="flex gap-2.5 items-center">
                  <PlaceholderImage label="Img" className="h-14 w-14" />
                  <div>
                    <div className="text-xs">{item.product.name}</div>
                    {item.product.variants.length > 0 && (
                      <select
                        value={item.variantId ?? ''}
                        disabled={pendingId === item.id}
                        onChange={(e) => changeVariant(item.id, e.target.value)}
                        className="text-[10px] text-text-2 bg-surface-2 border border-surface-2 rounded mt-1 py-0.5"
                      >
                        {item.product.variants.map((v) => (
                          <option key={v.id} value={v.id} disabled={v.stockQty <= 0}>
                            {v.size}
                            {v.stockQty <= 0 ? ' (out of stock)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        disabled={pendingId === item.id || item.qty <= 1}
                        className="h-5 w-5 flex items-center justify-center rounded border border-surface-2 text-[11px] text-text-2 disabled:opacity-40"
                      >
                        −
                      </button>
                      <small className="text-[10px] text-text-2 w-4 text-center">{item.qty}</small>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        disabled={pendingId === item.id}
                        className="h-5 w-5 flex items-center justify-center rounded border border-surface-2 text-[11px] text-text-2 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gold-light text-[12.5px]">{formatDualPrice(unitPrice(item) * item.qty)}</span>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={pendingId === item.id}
                    className="text-danger text-xs disabled:opacity-40"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
        <Card>
          <div className="flex justify-between text-[11.5px] text-text-2 mb-2.5">
            <span>Subtotal</span>
            <span>{formatDualPrice(subtotal)}</span>
          </div>
          <div className="border-t border-surface-2 my-4" />
          <div className="flex justify-between text-[15px] mb-4">
            <b>Total</b>
            <b className="text-gold-light">{formatDualPrice(subtotal)}</b>
          </div>
          <Link href="/checkout">
            <ButtonGold disabled={items.length === 0} className="w-full">
              Proceed to Checkout
            </ButtonGold>
          </Link>
        </Card>
      </div>
    </div>
  );
}
