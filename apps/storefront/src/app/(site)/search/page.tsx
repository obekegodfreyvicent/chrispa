import { apiGet, Product, ProductLine } from '@/lib/api';
import { ShopView } from '../shop/shop-view';

// Site-wide product search, reachable from the header search box on every
// storefront page (not just the Shop pages). Reuses ShopView's grid/sidebar
// so results look and behave exactly like browsing a category.
export default async function SearchPage(props: PageProps<'/search'>) {
  const searchParams = await props.searchParams;
  const raw = searchParams.q;
  const query = (Array.isArray(raw) ? raw[0] : (raw ?? '')).trim();

  const [lines, products] = await Promise.all([
    apiGet<ProductLine[]>('/catalog/product-lines').catch(() => [] as ProductLine[]),
    query
      ? apiGet<Product[]>(`/catalog/products?search=${encodeURIComponent(query)}&take=100`).catch(() => [] as Product[])
      : Promise.resolve([] as Product[]),
  ]);

  return <ShopView lines={lines} products={products} searchQuery={query} />;
}
