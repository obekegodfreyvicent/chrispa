import Link from 'next/link';
import { formatDualPrice, formatUgx, Product, ProductLine, WellnessTag } from '@/lib/api';
import { Card, Chip, PlaceholderImage } from '@/components/ui';

interface Filters {
  wellness?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
}

const RATING_OPTIONS = [4, 3, 2, 1];

// FR-3: Shop / Category (PLP) — shared between the "all products" shop
// landing page and each per-line page, so switching categories is always
// one click away instead of a trip back to the homepage. A plain server
// component (no 'use client') — category switching and every FR-3.2 filter
// (Wellness Need, Price, Rating) are all just navigation between real
// pages/URLs (query params), not client-side state.
export function ShopView({
  lines,
  currentLine,
  products,
  searchQuery,
  wellnessTags,
  activeWellnessTag,
  activeMinPrice,
  activeMaxPrice,
  activeRating,
}: {
  lines: ProductLine[];
  currentLine?: ProductLine;
  products: Product[];
  searchQuery?: string;
  wellnessTags?: WellnessTag[];
  activeWellnessTag?: string;
  activeMinPrice?: string;
  activeMaxPrice?: string;
  activeRating?: string;
}) {
  const basePath = currentLine ? `/shop/${currentLine.slug}` : '/shop';
  const current: Filters = {
    wellness: activeWellnessTag,
    minPrice: activeMinPrice,
    maxPrice: activeMaxPrice,
    rating: activeRating,
  };

  // Merges `overrides` onto the currently-active filters and renders the
  // result as a query string — every filter link/form in this page goes
  // through this so switching one filter never silently drops another
  // (e.g. picking a wellness need keeps an active price range). Pass a key
  // as `undefined` to clear just that filter.
  function buildQuery(overrides: Partial<Filters> = {}) {
    const merged = { ...current, ...overrides };
    const params = new URLSearchParams();
    if (merged.wellness) params.set('wellness', merged.wellness);
    if (merged.minPrice) params.set('minPrice', merged.minPrice);
    if (merged.maxPrice) params.set('maxPrice', merged.maxPrice);
    if (merged.rating) params.set('rating', merged.rating);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  const hasPriceFilter = !!(activeMinPrice || activeMaxPrice);
  const activeFilterLabels = [
    activeWellnessTag,
    hasPriceFilter
      ? `${activeMinPrice ? formatUgx(Number(activeMinPrice)) : 'UGX 0'}–${activeMaxPrice ? formatUgx(Number(activeMaxPrice)) : 'any'}`
      : null,
    activeRating ? `${activeRating}★ & up` : null,
  ].filter((v): v is string => !!v);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="font-serif text-xl mb-1">
        {searchQuery ? `Search results for "${searchQuery}"` : 'Shop'}
      </h1>
      <div className="text-[11px] text-text-2 mb-4">
        <Link href="/" className="hover:text-foreground">Home</Link> /{' '}
        {searchQuery ? (
          <span className="text-gold-light">Search</span>
        ) : (
          <>
            <Link href="/shop" className="hover:text-foreground">Shop</Link>
            {currentLine && <> / <span className="text-gold-light">{currentLine.name}</span></>}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <div>
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-2">Categories</div>
            <nav className="flex flex-col gap-1">
              <Link href={`/shop${buildQuery()}`}>
                <Chip gold={!currentLine} className="w-full block text-center">All Products</Chip>
              </Link>
              {lines.map((line) => (
                <Link key={line.id} href={`/shop/${line.slug}${buildQuery()}`}>
                  <Chip gold={currentLine?.slug === line.slug} className="w-full block text-center">
                    {line.name}
                  </Chip>
                </Link>
              ))}
            </nav>
          </Card>
          {wellnessTags && wellnessTags.length > 0 && (
            <Card className="mt-3.5">
              <div className="text-[10px] uppercase text-text-2 mb-2">Wellness Need</div>
              <div className="flex flex-wrap gap-1.5">
                {wellnessTags.map((tag) => {
                  const active = activeWellnessTag === tag.label;
                  return (
                    <Link key={tag.id} href={`${basePath}${buildQuery({ wellness: active ? undefined : tag.label })}`}>
                      <Chip gold={active}>{tag.label}</Chip>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
          {!searchQuery && (
            <>
              <Card className="mt-3.5">
                <div className="text-[10px] uppercase text-text-2 mb-2">Price (UGX)</div>
                <form method="get" action={basePath} className="flex flex-col gap-2">
                  {activeWellnessTag && <input type="hidden" name="wellness" value={activeWellnessTag} />}
                  {activeRating && <input type="hidden" name="rating" value={activeRating} />}
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      name="minPrice"
                      min={0}
                      step={1000}
                      defaultValue={activeMinPrice ?? ''}
                      placeholder="Min"
                      className="w-full bg-white border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]"
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      min={0}
                      step={1000}
                      defaultValue={activeMaxPrice ?? ''}
                      placeholder="Max"
                      className="w-full bg-white border border-[#CBDCC1] rounded-md px-2 py-1.5 text-[11px]"
                    />
                  </div>
                  <button type="submit" className="text-[10px] text-gold-light text-left hover:underline">
                    Apply
                  </button>
                </form>
              </Card>
              <Card className="mt-3.5">
                <div className="text-[10px] uppercase text-text-2 mb-2">Rating</div>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_OPTIONS.map((r) => {
                    const active = activeRating === String(r);
                    return (
                      <Link key={r} href={`${basePath}${buildQuery({ rating: active ? undefined : String(r) })}`}>
                        <Chip gold={active}>{r}★ &amp; up</Chip>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="text-[11.5px] text-text-2">{products.length} results</div>
            {activeWellnessTag && (
              <Link href={`${basePath}${buildQuery({ wellness: undefined })}`}>
                <Chip gold className="normal-case">{activeWellnessTag} ✕</Chip>
              </Link>
            )}
            {hasPriceFilter && (
              <Link href={`${basePath}${buildQuery({ minPrice: undefined, maxPrice: undefined })}`}>
                <Chip gold className="normal-case">
                  {activeMinPrice ? formatUgx(Number(activeMinPrice)) : 'UGX 0'}–
                  {activeMaxPrice ? formatUgx(Number(activeMaxPrice)) : 'any'} ✕
                </Chip>
              </Link>
            )}
            {activeRating && (
              <Link href={`${basePath}${buildQuery({ rating: undefined })}`}>
                <Chip gold className="normal-case">{activeRating}★ &amp; up ✕</Chip>
              </Link>
            )}
            {activeFilterLabels.length > 1 && (
              <Link href={basePath} className="text-[10px] text-text-2 hover:underline">
                Clear all filters
              </Link>
            )}
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-text-2">
              {searchQuery
                ? `No products found for "${searchQuery}". Try a different search term.`
                : `No products ${currentLine ? 'in this category' : 'available'}${
                    activeFilterLabels.length > 0 ? ` for ${activeFilterLabels.join(', ')}` : ''
                  } yet.`}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((product) => (
                <Link key={product.id} href={`/product/${product.slug}`}>
                  <Card className="hover:border-gold-dark transition-colors">
                    {product.media[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.media[0].url} alt={product.name} className="h-28 w-full object-cover rounded-md" />
                    ) : (
                      <PlaceholderImage label="Img" className="h-28 w-full" />
                    )}
                    <div className="mt-2 text-[11.5px]">{product.name}</div>
                    {!currentLine && <div className="text-[9.5px] text-text-2">{product.productLine.name}</div>}
                    <div className="text-gold-light text-xs">{formatDualPrice(product.priceUgx)}</div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
