import Link from 'next/link';
import { apiGet, SocialLink } from '@/lib/api';
import { NewsletterSignupForm } from './newsletter-signup-form';
import { Card } from './ui';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

// FR-1.6: footer link sitemap. Every link here is real — the CmsPage-backed
// ones (About Us, Contact Us, Store Location, Store Directory, Sell on
// ChrisPa, New Year Sale, Privacy Policy, Term & Conditions, Refund &
// Returns Policy) render through /pages/[slug] (FR-27, admin-editable
// content, Admin → CMS / Site Builder → Published Pages); FAQ deep-links
// into the Support page's FAQ card; My Account and Track Your Order point at
// real authenticated account routes (order tracking has no anonymous
// "enter your order number" entry point yet, so Track Your Order goes to
// the customer's own Order History instead).
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'ChrisPa',
    links: [
      { label: 'New Year Sale', href: '/pages/new-year-sale' },
      { label: 'Store Location', href: '/pages/store-location' },
      { label: 'Sell on ChrisPa', href: '/pages/sell-on-chrispa' },
      { label: 'FAQ', href: '/support#faq' },
      { label: 'Privacy Policy', href: '/pages/privacy-policy' },
    ],
  },
  {
    heading: 'Who We Are',
    links: [
      { label: 'About Us', href: '/pages/about-us' },
      { label: 'Contact Us', href: '/pages/contact-us' },
      { label: 'Store Directory', href: '/pages/store-directory' },
      { label: 'Term & Conditions', href: '/pages/term-conditions' },
    ],
  },
  {
    heading: 'Customer Care',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'Track Your Order', href: '/account/orders' },
      { label: 'Refund & Returns Policy', href: '/pages/refund-returns-policy' },
    ],
  },
];

// FR-1.6/FR-19.2: newsletter signup (real — see NewsletterSignupForm, a
// client island for the interactive bit) and social pages list (real —
// admin-managed, GET /cms/social-links) sit above the link sitemap. A
// server component, so this can just `await` the fetch directly — no
// 'use client'/useEffect needed for the parts that don't need interactivity.
export async function SiteFooter() {
  const socialLinks = await apiGet<SocialLink[]>('/cms/social-links').catch(() => [] as SocialLink[]);

  return (
    <footer className="px-4 sm:px-6 pb-8 flex flex-col gap-4">
      <Card className="flex flex-wrap justify-between gap-4">
        <NewsletterSignupForm />
        {socialLinks.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-2 mb-1">Follow ChrisPa</div>
            <div className="flex gap-2 flex-wrap">
              {socialLinks.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2.5 py-1 rounded-full bg-surface-2 border border-[#CBDCC1] text-text-2 hover:border-gold-dark hover:text-gold-light"
                >
                  {s.platform}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.heading}>
            <div className="text-[10px] uppercase tracking-wide text-text-2 mb-2">{col.heading}</div>
            <ul className="flex flex-col gap-1.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-[11.5px] text-foreground hover:text-gold-light">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </footer>
  );
}
