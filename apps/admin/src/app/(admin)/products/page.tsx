'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';
import { Card, ButtonGold, Status } from '@/components/ui';

interface ProductLine {
  id: string;
  name: string;
  slug: string;
}
interface Product {
  id: string;
  sku: string;
  name: string;
  priceUgx: number;
  stockQty: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  productLine: ProductLine;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const STATUS_VARIANT = { ACTIVE: 'ok', DRAFT: 'pending', ARCHIVED: 'danger' } as const;

// FR-21: Product Manager (real — list/search/filter/delete against /admin/products)
export default function ProductManagerPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [search, setSearch] = useState('');
  const [line, setLine] = useState('');
  const [authed, setAuthed] = useState(true);

  function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (line) params.set('line', line);
    authedFetch(`/admin/products?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProducts);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthed(false);
      return;
    }
    fetch(`${API_BASE_URL}/catalog/product-lines`).then((r) => r.json()).then(setLines).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, line]);

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? Products with order history are archived instead of deleted.`)) return;
    const res = await authedFetch(`/admin/products/${product.id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  if (!authed) {
    return (
      <Card>
        <p className="text-sm text-text-2">
          <Link href="/login" className="text-gold-light">Log in</Link> as Owner or Store Manager.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-3.5">
        <h1 className="font-serif text-xl">Product Manager</h1>
        <Link href="/products/new">
          <ButtonGold>+ Add Product</ButtonGold>
        </Link>
      </div>
      <div className="flex gap-2 mb-3.5">
        <input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] w-56"
        />
        <select
          value={line}
          onChange={(e) => setLine(e.target.value)}
          className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]"
        >
          <option value="">Line: All</option>
          {lines.map((l) => (
            <option key={l.id} value={l.slug}>{l.name}</option>
          ))}
        </select>
      </div>
      <Card className="p-0 overflow-hidden">
        {!products ? (
          <p className="text-sm text-text-2 p-4">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-text-2 p-4">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-gold-dark text-[10px] uppercase">
                <th className="p-2.5">Product</th>
                <th className="p-2.5">Line</th>
                <th className="p-2.5">SKU</th>
                <th className="p-2.5">Price</th>
                <th className="p-2.5">Stock</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-surface-2">
                  <td className="p-2.5">{p.name}</td>
                  <td className="p-2.5">{p.productLine.name}</td>
                  <td className="p-2.5">{p.sku}</td>
                  <td className="p-2.5">UGX {p.priceUgx.toLocaleString()}</td>
                  <td className="p-2.5">{p.stockQty}</td>
                  <td className="p-2.5">
                    <Status variant={STATUS_VARIANT[p.status]}>{p.status}</Status>
                  </td>
                  <td className="p-2.5">
                    <Link href={`/products/${p.id}`} className="text-gold-light mr-2.5">Edit</Link>
                    <button onClick={() => handleDelete(p)} className="text-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
      <small className="block text-[10px] text-text-2 mt-2">Showing {products?.length ?? 0} SKUs</small>
    </div>
  );
}
