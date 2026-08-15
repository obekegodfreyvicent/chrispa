'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/auth-client';
import { Card, ButtonGold, ButtonOutline, ButtonDanger, Chip } from '@/components/ui';

interface ProductLine {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface ExistingProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  productLineId: string;
  priceUgx: number;
  stockQty: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  scentOrFlavorNotes: string | null;
  directions: string | null;
  healthBenefits: string | null;
  seoTitle: string | null;
  seoMeta: string | null;
  wellnessTags: { wellnessTag: { label: string } }[];
  media: { url: string }[];
  // MKT-FR-1/FIN-FR-7 (docs/SRS.md §21): null vendorId = ChrisPa-owned
  // (the default); costUgx is the cost basis used for COGS at revenue
  // recognition, optional since not every product has one set.
  vendorId: string | null;
  costUgx: number | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export function ProductForm({ existing }: { existing?: ExistingProduct }) {
  const router = useRouter();
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(existing?.name ?? '');
  const [sku, setSku] = useState(existing?.sku ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [productLineId, setProductLineId] = useState(existing?.productLineId ?? '');
  const [priceUgx, setPriceUgx] = useState(existing?.priceUgx ?? 0);
  const [stockQty, setStockQty] = useState(existing?.stockQty ?? 0);
  const [status, setStatus] = useState(existing?.status ?? 'DRAFT');
  const [notes, setNotes] = useState(existing?.scentOrFlavorNotes ?? '');
  const [directions, setDirections] = useState(existing?.directions ?? '');
  const [healthBenefits, setHealthBenefits] = useState(existing?.healthBenefits ?? '');
  const [seoTitle, setSeoTitle] = useState(existing?.seoTitle ?? '');
  const [seoMeta, setSeoMeta] = useState(existing?.seoMeta ?? '');
  const [tagsInput, setTagsInput] = useState(existing?.wellnessTags.map((t) => t.wellnessTag.label).join(', ') ?? '');
  const [media, setMedia] = useState<string[]>(existing?.media.map((m) => m.url) ?? []);
  const [mediaPending, setMediaPending] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState(existing?.vendorId ?? '');
  const [costUgx, setCostUgx] = useState(existing?.costUgx?.toString() ?? '');

  useEffect(() => {
    authedFetch('/admin/vendors').then((r) => (r.ok ? r.json() : [])).then(setVendors);
  }, []);

  async function handlePhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file(s) later
    if (files.length === 0) return;
    setMediaPending(true);
    setMediaError(null);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authedFetch('/admin/products/media/upload', { method: 'POST', body: formData });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setMediaError(body?.message ?? `Could not upload ${file.name}.`);
          continue;
        }
        setMedia((prev) => [...prev, body.url]);
      }
    } finally {
      setMediaPending(false);
    }
  }

  function removeMedia(url: string) {
    setMedia((prev) => prev.filter((u) => u !== url));
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/catalog/product-lines`).then((r) => r.json()).then(setLines).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body = {
      name,
      sku,
      slug: slug || undefined,
      productLineId,
      priceUgx: Number(priceUgx),
      stockQty: Number(stockQty),
      status,
      scentOrFlavorNotes: notes || undefined,
      directions: directions || undefined,
      healthBenefits: healthBenefits || undefined,
      seoTitle: seoTitle || undefined,
      seoMeta: seoMeta || undefined,
      wellnessTags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      mediaUrls: media,
      vendorId: vendorId || undefined,
      costUgx: costUgx ? Number(costUgx) : undefined,
    };
    try {
      const res = await authedFetch(existing ? `/admin/products/${existing.id}` : '/admin/products', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => null);
      if (!res.ok) {
        setError(Array.isArray(resBody?.message) ? resBody.message.join(', ') : (resBody?.message ?? 'Could not save product.'));
        return;
      }
      router.push('/products');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    if (!confirm(`Delete "${existing.name}"? Products with order history are archived instead of deleted.`)) return;
    const res = await authedFetch(`/admin/products/${existing.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/products');
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-serif text-xl mb-4">{existing ? `Edit Product: ${existing.name}` : 'Add Product'}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Product Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">SKU</label>
              <input required value={sku} onChange={(e) => setSku(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Product Line</label>
              <select required value={productLineId} onChange={(e) => setProductLineId(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                <option value="" disabled>Select a line…</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Scent / Flavor Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[10px] uppercase text-text-2 block mb-1">Uses (comma-separated tags)</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Sleep & Calm, Focus & Energy"
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {tagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <Chip key={t} gold>{t}</Chip>)}
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[10px] uppercase text-text-2 block mb-1">Directions</label>
            <textarea value={directions} onChange={(e) => setDirections(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-14" />
          </div>
          <div className="mt-3">
            <label className="text-[10px] uppercase text-text-2 block mb-1">Health Benefits</label>
            <textarea value={healthBenefits} onChange={(e) => setHealthBenefits(e.target.value)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px] h-14" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Price (UGX)</label>
              <input required type="number" min={0} value={priceUgx} onChange={(e) => setPriceUgx(Number(e.target.value))}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Stock Qty</label>
              <input required type="number" min={0} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Vendor (Marketplace)</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
                <option value="">ChrisPa (no vendor)</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-text-2 block mb-1">Cost (UGX) — for COGS</label>
              <input type="number" min={0} value={costUgx} onChange={(e) => setCostUgx(e.target.value)} placeholder="Optional"
                className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[10px] uppercase text-text-2 block mb-1">SEO — Slug / Title / Meta</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input placeholder="url-slug (auto if blank)" value={slug} onChange={(e) => setSlug(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input placeholder="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
              <input placeholder="SEO meta description" value={seoMeta} onChange={(e) => setSeoMeta(e.target.value)}
                className="bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]" />
            </div>
          </div>
        </Card>

        <div>
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-1">Photos / Media</div>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {media.map((url) => (
                  <div key={url} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover rounded-md border border-[#CBDCC1]" />
                    <button
                      type="button"
                      onClick={() => removeMedia(url)}
                      aria-label="Remove photo"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white text-[11px] leading-none flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handlePhotosSelected}
            />
            <ButtonOutline type="button" className="w-full" disabled={mediaPending} onClick={() => fileInputRef.current?.click()}>
              {mediaPending ? 'Uploading…' : '+ Attach / Upload Photo'}
            </ButtonOutline>
            {mediaError && <p className="text-danger text-[11px] mt-2">{mediaError}</p>}
          </Card>
          <Card className="mt-3.5">
            <label className="text-[10px] uppercase text-text-2 block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full bg-white border border-[#CBDCC1] rounded-md px-2.5 py-2 text-[11.5px]">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {status !== 'ACTIVE' && (
              <p className="text-[10.5px] text-text-2 mt-1.5">
                Only <strong>Active</strong> products appear in the storefront Shop — {status === 'DRAFT' ? 'this one is hidden until you switch it to Active' : 'archived products stay hidden'}.
              </p>
            )}
            <div className="border-t border-surface-2 my-3" />
            {error && <p className="text-xs text-danger mb-2.5">{error}</p>}
            <ButtonGold type="submit" disabled={pending} className="w-full">
              {pending ? 'Saving…' : 'Save Product'}
            </ButtonGold>
            {existing && (
              <ButtonDanger type="button" onClick={handleDelete} className="w-full mt-2">
                Delete
              </ButtonDanger>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}
