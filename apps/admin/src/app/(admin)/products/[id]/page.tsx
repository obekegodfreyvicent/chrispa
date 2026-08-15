'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card } from '@/components/ui';
import { ProductForm } from '../product-form';

// FR-22: Edit Product
export default function EditProductPage(props: PageProps<'/products/[id]'>) {
  const { id } = use(props.params);
  const [product, setProduct] = useState<React.ComponentProps<typeof ProductForm>['existing'] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    authedFetch(`/admin/products/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-sm text-text-2">Loading…</div>;

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card>
        <p className="text-sm text-text-2">Product not found.</p>
      </Card>
    );
  }

  return <ProductForm existing={product} />;
}
