import { apiGet, firstParam, Product, ProductLine, WellnessTag } from '@/lib/api';
import { ShopView } from './shop-view';

// FR-3: Shop landing — every active product across all lines, with the
// category switcher always visible. This is what "Shop" in the header now
// links to, instead of a single hardcoded line.
export default async function ShopPage(props: PageProps<'/shop'>) {
  const searchParams = await props.searchParams;
  const wellness = firstParam(searchParams.wellness);
  const minPrice = firstParam(searchParams.minPrice);
  const maxPrice = firstParam(searchParams.maxPrice);
  const rating = firstParam(searchParams.rating);

  const query = new URLSearchParams({ take: '100' });
  if (wellness) query.set('wellness', wellness);
  if (minPrice) query.set('minPrice', minPrice);
  if (maxPrice) query.set('maxPrice', maxPrice);
  if (rating) query.set('rating', rating);

  const [lines, wellnessTags, products] = await Promise.all([
    apiGet<ProductLine[]>('/catalog/product-lines').catch(() => [] as ProductLine[]),
    apiGet<WellnessTag[]>('/catalog/wellness-tags').catch(() => [] as WellnessTag[]),
    apiGet<Product[]>(`/catalog/products?${query}`).catch(() => [] as Product[]),
  ]);

  return (
    <ShopView
      lines={lines}
      products={products}
      wellnessTags={wellnessTags}
      activeWellnessTag={wellness}
      activeMinPrice={minPrice}
      activeMaxPrice={maxPrice}
      activeRating={rating}
    />
  );
}
