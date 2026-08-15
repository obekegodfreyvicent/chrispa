import { notFound } from 'next/navigation';
import { apiGet, firstParam, Product, ProductLine, WellnessTag } from '@/lib/api';
import { ShopView } from '../shop-view';

// FR-3: Shop / Category (PLP) — products filtered to one line, with the
// same category switcher as /shop so moving between lines never requires
// going back to the homepage.
export default async function ShopLinePage(props: PageProps<'/shop/[line]'>) {
  const { line } = await props.params;
  const searchParams = await props.searchParams;
  const wellness = firstParam(searchParams.wellness);
  const minPrice = firstParam(searchParams.minPrice);
  const maxPrice = firstParam(searchParams.maxPrice);
  const rating = firstParam(searchParams.rating);

  const query = new URLSearchParams({ line });
  if (wellness) query.set('wellness', wellness);
  if (minPrice) query.set('minPrice', minPrice);
  if (maxPrice) query.set('maxPrice', maxPrice);
  if (rating) query.set('rating', rating);

  const [lines, wellnessTags, products] = await Promise.all([
    apiGet<ProductLine[]>('/catalog/product-lines').catch(() => [] as ProductLine[]),
    apiGet<WellnessTag[]>('/catalog/wellness-tags').catch(() => [] as WellnessTag[]),
    apiGet<Product[]>(`/catalog/products?${query}`).catch(() => [] as Product[]),
  ]);

  const currentLine = lines.find((l) => l.slug === line);
  if (!currentLine) notFound();

  return (
    <ShopView
      lines={lines}
      currentLine={currentLine}
      products={products}
      wellnessTags={wellnessTags}
      activeWellnessTag={wellness}
      activeMinPrice={minPrice}
      activeMaxPrice={maxPrice}
      activeRating={rating}
    />
  );
}
