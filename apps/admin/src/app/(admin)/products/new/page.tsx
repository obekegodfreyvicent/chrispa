'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth-client';
import { Card } from '@/components/ui';
import { ProductForm } from '../product-form';

// FR-22: Add Product
export default function NewProductPage() {
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    setAuthed(!!getAccessToken());
  }, []);

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  return <ProductForm />;
}
