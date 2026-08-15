'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { ButtonGhost } from '@/components/ui';

export function WishlistButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    authedFetch('/wishlist')
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { product: { id: string } }[]) => setSaved(items.some((i) => i.product.id === productId)));
  }, [productId]);

  async function toggle() {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    setPending(true);
    try {
      if (saved) {
        await authedFetch(`/wishlist/${productId}`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await authedFetch('/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        setSaved(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <ButtonGhost onClick={toggle} disabled={pending} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}>
      {saved ? '♥' : '♡'}
    </ButtonGhost>
  );
}
