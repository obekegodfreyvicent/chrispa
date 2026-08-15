'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { formatDualPrice } from '@/lib/api';
import { Card, PlaceholderImage, ButtonOutline } from '@/components/ui';

interface WishlistItem {
  id: string;
  product: { id: string; slug: string; name: string; priceUgx: number; stockQty: number };
}

// FR-15: Wishlist / Favorites
export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [authed, setAuthed] = useState(true);

  function load() {
    authedFetch('/wishlist').then((r) => (r.ok ? r.json() : [])).then(setItems);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    load();
  }, []);

  async function remove(productId: string) {
    await authedFetch(`/wishlist/${productId}`, { method: 'DELETE' });
    load();
  }

  async function addToCart(productId: string) {
    await authedFetch('/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, qty: 1 }),
    });
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> to view your wishlist.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-xl mb-4">Wishlist / Favorites</h1>
      {!items ? (
        <p className="text-sm text-text-2">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-text-2">
            Your wishlist is empty. <Link href="/" className="text-gold-light">Browse products</Link>.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <Link href={`/product/${item.product.slug}`}>
                <PlaceholderImage label="Img" className="h-24 w-full" />
                <div className="mt-2 text-[11.5px]">{item.product.name}</div>
              </Link>
              <div className="text-gold-light text-xs">{formatDualPrice(item.product.priceUgx)}</div>
              <div className="flex gap-2 mt-2">
                <ButtonOutline className="flex-1" disabled={item.product.stockQty <= 0} onClick={() => addToCart(item.product.id)}>
                  Add to Cart
                </ButtonOutline>
                <button onClick={() => remove(item.product.id)} className="text-danger text-xs">✕</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
