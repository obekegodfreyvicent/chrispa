const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Next.js 16's searchParams values are `string | string[] | undefined` —
// every Shop-page query param (wellness, minPrice, maxPrice, rating) only
// ever takes one value, so this collapses that to the shape they actually want.
export function firstParam(raw: string | string[] | undefined): string | undefined {
  return (Array.isArray(raw) ? raw[0] : raw) || undefined;
}

export interface ProductLine {
  id: string;
  name: string;
  slug: string;
  unitSize: string;
}

export interface WellnessTag {
  id: string;
  label: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
}

export interface CmsPage {
  title: string;
  slug: string;
  body: string;
}

export interface ProductMedia {
  id: string;
  url: string;
}

export interface Variant {
  id: string;
  size: string;
  priceDelta: number;
  stockQty: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  priceUgx: number;
  stockQty: number;
  status: string;
  scentOrFlavorNotes: string | null;
  directions: string | null;
  healthBenefits: string | null;
  productLine: ProductLine;
  media: ProductMedia[];
  variants: Variant[];
  wellnessTags?: { wellnessTag: WellnessTag }[];
}

export function formatUgx(amount: number) {
  return `UGX ${amount.toLocaleString('en-UG')}`;
}

// Static, manually-set approximate rate — there's no live FX-rate feed wired
// in anywhere in this codebase (same "no external provider connected yet"
// constraint already documented for payments/email/SMS elsewhere), and the
// Finance module's `LegalEntity.currentGroupFxRate` is a separate, admin-only
// rate scoped to multi-entity accounting consolidation, not customer pricing
// — reusing it here would wire customer-facing prices to an accounting
// concern with a different purpose. Update this constant to move the rate.
export const USD_PER_UGX = 1 / 3800;

export function formatUsd(amountUgx: number) {
  return `$${(amountUgx * USD_PER_UGX).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// FR-1/FR-3/FR-4/FR-14 etc: every customer-facing "listed price" — product
// cards, cart, checkout, order tracking/receipt, wishlist — shows both
// currencies together, UGX first (the store's real, charged currency; every
// order/payment/refund amount is still UGX end-to-end) with the USD estimate
// alongside for shoppers thinking in dollars. Never used for anything the
// customer pays with — Checkout/Cart totals sent to the API are still UGX
// integers, this is purely a read-only display convenience.
export function formatDualPrice(amountUgx: number) {
  return `${formatUgx(amountUgx)} (~${formatUsd(amountUgx)})`;
}
