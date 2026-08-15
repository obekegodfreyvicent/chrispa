import Link from 'next/link';
import { apiGet, Banner, ProductLine, WellnessTag } from '@/lib/api';
import { Card, Chip, PlaceholderImage, SectionLabel } from '@/components/ui';

// FR-1: Homepage — hero, category entry points, personalization, trust signals
export default async function HomePage() {
  const [productLines, wellnessTags, banners] = await Promise.all([
    apiGet<ProductLine[]>('/catalog/product-lines').catch(() => [] as ProductLine[]),
    apiGet<WellnessTag[]>('/catalog/wellness-tags').catch(() => [] as WellnessTag[]),
    apiGet<Banner[]>('/cms/banners').catch(() => [] as Banner[]),
  ]);
  const hero = banners[0];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <Card className="p-0 overflow-hidden">
        {hero ? (
          hero.linkUrl ? (
            <Link href={hero.linkUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.imageUrl} alt="" className="h-64 w-full object-cover" />
            </Link>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.imageUrl} alt="" className="h-64 w-full object-cover" />
          )
        ) : (
          <PlaceholderImage
            label="Hero banner — seasonal promo / lifestyle image"
            className="h-64 rounded-none w-full"
          />
        )}
      </Card>

      <div>
        <SectionLabel>Shop by Line</SectionLabel>
        {productLines.length === 0 ? (
          <p className="text-sm text-text-2">
            No product lines published yet — add some in the admin Product Manager.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {productLines.map((line) => (
              <Link key={line.id} href={`/shop/${line.slug}`}>
                <Card className="text-center hover:border-gold-dark transition-colors">
                  <PlaceholderImage label={line.name} className="h-24 w-full" />
                  <div className="mt-2 text-[11.5px]">{line.name}</div>
                  <small className="text-[10px] text-text-2">{line.unitSize}</small>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Shop by Wellness Need</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {wellnessTags.length === 0 ? (
            <p className="text-sm text-text-2">No wellness tags published yet.</p>
          ) : (
            wellnessTags.map((tag) => (
              <Link key={tag.id} href={`/shop?wellness=${encodeURIComponent(tag.label)}`}>
                <Chip gold>{tag.label}</Chip>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <SectionLabel>Bestsellers / Recommended</SectionLabel>
          <p className="text-sm text-text-2">Coming soon — recommendation engine is follow-up work.</p>
        </div>
        <div>
          <SectionLabel>Brand Story + Trust Strip</SectionLabel>
          <Card>
            <p className="text-xs text-text-2 mb-2.5">
              Our founders&apos; story — real, locally-sourced ingredients and no harsh chemicals, Kampala-made.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <Chip>🔒 Secure Checkout</Chip>
              <Chip>🚚 Kampala Same-Day</Chip>
              <Chip>🌿 No Parabens</Chip>
              <Chip>↩ Easy Returns</Chip>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
