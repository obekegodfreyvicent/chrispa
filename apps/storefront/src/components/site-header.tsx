'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken, logout } from '@/lib/auth-client';

export function SiteHeader() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setSignedIn(!!getAccessToken());
  }, []);

  async function handleLogout() {
    await logout();
    setSignedIn(false);
    setMobileOpen(false);
    router.push('/');
  }

  // No standalone "Log In" link — "Account" is the single entry point for
  // both signed-in and signed-out visitors, and always goes to /account:
  // that page itself renders the Log In / Create Account forms when signed
  // out, and the real account dashboard when signed in. "Log Out" still
  // needs its own control once signed in.
  const authControl = signedIn ? (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 rounded-md border border-[#CBDCC1] text-text-2 text-[11px] font-semibold text-left"
    >
      Log Out
    </button>
  ) : null;

  const searchIcon = (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );

  return (
    <header className="relative flex-none border-b border-surface-2 bg-gradient-to-b from-[#F7FAF4] to-white">
      <div className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <svg viewBox="0 0 100 100" className="w-8 h-8 shrink-0">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1B5E20" strokeWidth="3" />
            <text x="50" y="63" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="46" fill="#3F7D32">
              C
            </text>
          </svg>
          <span className="leading-tight">
            <span className="block font-serif italic text-gold-light text-sm">ChrisPa Scents and Soaps</span>
            <span className="hidden sm:block text-[8.5px] tracking-[0.18em] text-text-2">NATURAL WELLNESS</span>
          </span>
        </Link>

        <form
          action="/search"
          role="search"
          className="hidden md:flex items-center gap-1.5 flex-1 max-w-xs px-2.5 py-1.5 rounded-md border border-surface-2 bg-white focus-within:border-gold-dark"
        >
          {searchIcon}
          <input
            type="search"
            name="q"
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full text-[11px] outline-none placeholder:text-text-2"
          />
        </form>

        <nav className="hidden md:flex items-center gap-5 text-xs text-text-2">
          <Link href="/shop" className="hover:text-foreground">Shop</Link>
          <Link href="/support" className="hover:text-foreground">Support</Link>
          <Link href="/account" className="hover:text-foreground">Account</Link>
          <Link href="/cart" className="hover:text-foreground">Cart</Link>
          {authControl}
        </nav>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8"
        >
          <span className={`block h-0.5 w-6 bg-foreground transition-transform ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-6 bg-foreground transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 bg-foreground transition-transform ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {mobileOpen && (
        <nav className="md:hidden flex flex-col gap-1 px-4 pb-4 text-xs text-text-2 border-t border-surface-2 bg-white">
          <form
            action="/search"
            role="search"
            className="flex items-center gap-1.5 mt-3 mb-1 px-2.5 py-2 rounded-md border border-surface-2 bg-white focus-within:border-gold-dark"
          >
            {searchIcon}
            <input
              type="search"
              name="q"
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full text-[11px] outline-none placeholder:text-text-2"
            />
          </form>
          <Link href="/shop" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-surface-2">Shop</Link>
          <Link href="/support" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-surface-2">Support</Link>
          <Link href="/account" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-surface-2">Account</Link>
          <Link href="/cart" onClick={() => setMobileOpen(false)} className="py-2.5 border-b border-surface-2">Cart</Link>
          {authControl && <div className="pt-2.5">{authControl}</div>}
        </nav>
      )}
    </header>
  );
}
