import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiGet, CmsPage } from '@/lib/api';
import { Card } from '@/components/ui';

// FR-27: CMS / Site Builder — Published Pages. A plain text-body render;
// no rich-text/HTML rendering, matching CmsPage.body being a plain string
// (no WYSIWYG editor exists admin-side either).
export default async function CmsPageView(props: PageProps<'/pages/[slug]'>) {
  const { slug } = await props.params;
  const page = await apiGet<CmsPage>(`/cms/pages/${slug}`).catch(() => null);
  if (!page) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="text-[11px] text-text-2 mb-4">
        <Link href="/" className="hover:text-foreground">Home</Link> / <span className="text-gold-light">{page.title}</span>
      </div>
      <Card>
        <h1 className="font-serif text-xl mb-3">{page.title}</h1>
        <div className="text-[12.5px] whitespace-pre-wrap">{page.body}</div>
      </Card>
    </div>
  );
}
