-- Product.slug already serves as the SEO/routing slug; seoSlug duplicated it.
ALTER TABLE "Product" DROP COLUMN "seoSlug";
