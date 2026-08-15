'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authedFetch, getAccessToken } from '@/lib/auth-client';

const NAV = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile & Photo' },
  { href: '/account/addresses', label: 'Address Book' },
  { href: '/account/orders', label: 'Order History' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/account/payments', label: 'Saved Payments' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/settings', label: 'Settings & Notifications' },
  { href: '/account/loyalty', label: 'Loyalty & Rewards' },
  { href: '/account/social', label: 'Connected & Social' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const isSignedIn = !!getAccessToken();
    setSignedIn(isSignedIn);
    if (!isSignedIn) return;
    authedFetch('/account/notifications/unread-count')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((data) => setUnreadCount(data.count ?? 0));
  }, [pathname]);

  // Signed out, there are no account sub-sections to navigate to yet — the
  // page itself is just the Log In / Create an Account forms, full width,
  // with no sub-nav alongside them.
  if (!signedIn) {
    return <div className="p-4 sm:p-6 max-w-6xl mx-auto">{children}</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <nav className="flex md:block gap-1.5 overflow-x-auto md:overflow-visible bg-surface border border-surface-2 rounded-[10px] p-2.5 md:h-fit">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[12.5px] mb-0.5 whitespace-nowrap flex-none md:flex-auto ${
              pathname === item.href ? 'bg-surface-2 text-gold-light border-l-2 border-gold' : 'text-text-2 hover:bg-surface-2'
            }`}
          >
            {item.label}
            {item.href === '/account/notifications' && unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-gold text-white text-[9.5px] font-semibold">
                {unreadCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
