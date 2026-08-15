import { notFound } from 'next/navigation';
import { apiGet, formatDualPrice, Product } from '@/lib/api';
import { Card, Chip, PlaceholderImage } from '@/components/ui';
import { AddToCartButton } from './add-to-cart-button';
import { WishlistButton } from './wishlist-button';

// FR-2: Product Detail Page — media, variants, uses/directions/health benefits, reviews
export default async function ProductPage(props: PageProps<'/product/[slug]'>) {
  const { slug } = await props.params;
  const product = await apiGet<Product>(`/catalog/products/${slug}`).catch(() => null);
  if (!product) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        {product.media[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.media[0].url} alt={product.name} className="h-84 w-full object-cover rounded-md" />
        ) : (
          <PlaceholderImage label="Main image — zoom on hover" className="h-84 w-full" />
        )}
        {/* Click-to-swap-main-image and zoom-on-hover are follow-up work — this
            is a static gallery for now, not yet the interactive one the
            wireframe annotates. */}
        {product.media.length > 1 && (
          <div className="grid grid-cols-4 gap-2.5 mt-2.5">
            {product.media.slice(0, 4).map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className="h-15 w-full object-cover rounded-md" />
            ))}
          </div>
        )}
      </div>

      <div>
        <Chip gold>{product.productLine.name}</Chip>
        <h1 className="font-serif text-xl mt-2.5">{product.name}</h1>
        {product.scentOrFlavorNotes && (
          <div className="text-xs text-text-2">{product.scentOrFlavorNotes}</div>
        )}
        <div className="text-gold-light text-2xl font-serif mt-2">{formatDualPrice(product.priceUgx)}</div>

        <div className="flex gap-2.5 mt-4 items-start">
          <AddToCartButton productId={product.id} variants={product.variants} disabled={product.stockQty <= 0} />
          <WishlistButton productId={product.id} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-1">Uses</div>
            <small className="text-[10px] text-text-2">{product.wellnessTags?.map((t) => t.wellnessTag.label).join(' · ') || '—'}</small>
          </Card>
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-1">Directions</div>
            <small className="text-[10px] text-text-2">{product.directions ?? '—'}</small>
          </Card>
          <Card>
            <div className="text-[10px] uppercase text-text-2 mb-1">Health Benefits</div>
            <small className="text-[10px] text-text-2">{product.healthBenefits ?? '—'}</small>
          </Card>
        </div>
      </div>
    </div>
  );
}
