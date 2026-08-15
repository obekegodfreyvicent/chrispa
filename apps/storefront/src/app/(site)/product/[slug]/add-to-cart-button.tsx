'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getAccessToken, authedFetch } from '@/lib/auth-client';
import { ButtonGold, ButtonOutline } from '@/components/ui';
import { Variant } from '@/lib/api';

// FR-2.2: variant (size) selection lives here rather than as static chips —
// the chosen variantId feeds both Add to Cart and (once picked) the price shown.
export function AddToCartButton({
  productId,
  variants,
  disabled,
}: {
  productId: string;
  variants: Variant[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const inStockVariants = variants.filter((v) => v.stockQty > 0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(inStockVariants[0]?.id);

  async function handleAddToCart() {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    setPending(true);
    try {
      const res = await authedFetch('/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variantId: selectedVariantId, qty: 1 }),
      });
      if (res.ok) router.push('/cart');
    } finally {
      setPending(false);
    }
  }

  const needsVariant = variants.length > 0 && !selectedVariantId;

  return (
    <div>
      {variants.length > 0 && (
        <>
          <div className="text-[10px] uppercase text-text-2 mt-4 mb-1">Size</div>
          <div className="flex gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.stockQty <= 0}
                onClick={() => setSelectedVariantId(v.id)}
                className={`text-[10px] px-2.5 py-1 rounded-full border disabled:opacity-40 disabled:line-through ${
                  selectedVariantId === v.id
                    ? 'text-white bg-gold border-gold'
                    : 'text-text-2 border-[#CBDCC1] bg-surface-2'
                }`}
              >
                {v.size}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-2.5 mt-4">
        <ButtonGold onClick={handleAddToCart} disabled={disabled || pending || needsVariant}>
          {pending ? 'Adding…' : 'Add to Cart'}
        </ButtonGold>
        <ButtonOutline disabled={disabled || needsVariant}>Buy Now</ButtonOutline>
      </div>
    </div>
  );
}
