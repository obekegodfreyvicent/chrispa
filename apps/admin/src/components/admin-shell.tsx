'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken, getMustChangePassword, getUserRole, logout, UserRole } from '@/lib/auth-client';
import { useIdleLogout } from '@/lib/use-idle-logout';

const NAV = [
  { href: '/', icon: '▤', label: 'Dashboard' },
  { href: '/products', icon: '▥', label: 'Product Manager' },
  { href: '/orders', icon: '▦', label: 'Order Management' },
  { href: '/inventory', icon: '▧', label: 'Inventory' },
  { href: '/customers', icon: '◈', label: 'Customers (CRM)' },
  { href: '/support-tickets', icon: '✉', label: 'Support Tickets' },
  { href: '/marketing', icon: '%', label: 'Marketing & Promos' },
  { href: '/cms', icon: '▧', label: 'CMS / Site Builder' },
  { href: '/settings', icon: '⚙', label: 'Users & Settings' },
  { href: '/activity-log', icon: '≡', label: 'Activity Log' },
];

// HR oversight — Owner/HR Manager only (enforced server-side; these links
// are just navigation, not the access control).
const HR_NAV = [
  { href: '/hr/dashboard', icon: '▤', label: 'HR Dashboard' },
  { href: '/hr/employees', icon: '☺', label: 'Employees' },
  { href: '/hr/departments', icon: '◫', label: 'Departments' },
  { href: '/hr/attendance', icon: '◷', label: 'Attendance' },
  { href: '/hr/leave-requests', icon: '☐', label: 'Leave Requests' },
  { href: '/hr/shifts', icon: '▦', label: 'Shift Scheduling' },
  { href: '/hr/recruitment', icon: '⚑', label: 'Recruitment' },
  { href: '/hr/payroll', icon: '$', label: 'Payroll' },
];

// Self-service — any signed-in staff member with a linked Employee record.
const MY_HR_NAV = [
  { href: '/my-hr/profile', icon: '☺', label: 'My Profile' },
  { href: '/my-hr/attendance', icon: '◷', label: 'Clock In / Out' },
  { href: '/my-hr/leave', icon: '☐', label: 'My Leave' },
  { href: '/my-hr/shifts', icon: '▦', label: 'My Shifts' },
  { href: '/my-hr/performance', icon: '★', label: 'My Performance' },
  { href: '/my-hr/payslips', icon: '$', label: 'My Payslips' },
  { href: '/my-hr/advances', icon: '$', label: 'My Salary Advances' },
];

// Its own top-level section, not an item nested under Admin/Backend — a
// deliberate, later change (per user request) mirroring how Human
// Resources / My HR are already separate sections rather than folded into
// Admin/Backend. Owner-only, same as it was as a nested item — see
// visibleSections() below.
const FINANCE_NAV = [
  { href: '/finance', icon: '$', label: 'Financial & Accounting' },
];

const ALL_NAV = [...NAV, ...HR_NAV, ...MY_HR_NAV, ...FINANCE_NAV];

const SECTIONS = [
  { key: 'admin', title: 'Admin / Backend', items: NAV },
  { key: 'hr', title: 'Human Resources', items: HR_NAV },
  { key: 'my-hr', title: 'My HR', items: MY_HR_NAV },
  { key: 'finance', title: 'Financial & Accounting', items: FINANCE_NAV },
];

function sectionHasActiveItem(items: { href: string }[], pathname: string | null) {
  return items.some((item) => pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href)));
}

// Access policy: Owner sees everything. HR Manager sees Human Resources +
// My HR only — no Admin/Backend, no Financial & Accounting. Store Manager
// and Fulfillment both see Admin/Backend (minus Users & Settings and
// Activity Log, which stay Owner-only) + My HR — no Human Resources
// oversight, no Financial & Accounting; the difference between them (Store
// Manager has full read/write, Fulfillment is read-only except
// order-status transitions) is enforced server-side (RolesGuard), not by
// which tabs show here. Support Tickets is further restricted within that
// Admin/Backend filter to Store Manager only — Fulfillment isn't in
// AdminSupportController's @Roles() list, so hide the link rather than
// showing one that 403s. Financial & Accounting is Owner-only outright —
// the whole section is hidden rather than filtering an item out of it,
// since every /admin/finance/* endpoint is Owner-only server-side (see
// EntitiesController's Access Control note). `role === null` covers the
// brief pre-hydration window before the client reads the JWT — default to
// unfiltered so legitimate Owners don't see a flash of a stripped-down nav.
function visibleSections(role: UserRole | null) {
  if (role === null || role === 'OWNER') return SECTIONS;
  if (role === 'HR_MANAGER') return SECTIONS.filter((s) => s.key !== 'admin' && s.key !== 'finance');
  if (role === 'STORE_MANAGER' || role === 'FULFILLMENT') {
    return SECTIONS.filter((s) => s.key !== 'hr' && s.key !== 'finance').map((s) =>
      s.key === 'admin'
        ? {
            ...s,
            items: s.items.filter(
              (item) =>
                item.href !== '/settings' &&
                item.href !== '/activity-log' &&
                (role === 'STORE_MANAGER' || item.href !== '/support-tickets'),
            ),
          }
        : s,
    );
  }
  // SUPPORT_AGENT: least-privilege staff role whose one real write
  // permission (AdminSupportController's @Roles()) is Support Tickets —
  // surface exactly that item, plus My HR self-service like every other
  // staff role gets.
  if (role === 'SUPPORT_AGENT') {
    return [
      { key: 'admin', title: 'Admin / Backend', items: NAV.filter((item) => item.href === '/support-tickets') },
      ...SECTIONS.filter((s) => s.key === 'my-hr'),
    ];
  }
  // CUSTOMER, or any other role landing in the admin console — least
  // privilege: self-service only.
  return SECTIONS.filter((s) => s.key === 'my-hr');
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current =
    ALL_NAV.find((n) => n.href === pathname) ??
    ALL_NAV.filter((n) => n.href !== '/' && pathname?.startsWith(n.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Collapsed by default — a section only starts open if it contains the
  // current page, so navigating in never hides where you already are.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, sectionHasActiveItem(s.items, pathname)])),
  );

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    setSignedIn(!!getAccessToken());
    setRole(getUserRole());
    // Mirrors MustChangePasswordGuard client-side: a temp-password account
    // shouldn't be able to reach any admin page (even if the API would 403
    // the underlying requests, landing on a page full of failed fetches
    // isn't the same as being told what to do).
    if (getMustChangePassword()) {
      router.replace('/change-password');
    }
  }, [router]);

  const sections = visibleSections(role);

  // Auto-close the mobile drawer on navigation — desktop ignores this since
  // the sidebar is always visible there regardless of sidebarOpen.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout(reason?: 'idle') {
    await logout();
    setSignedIn(false);
    router.push(reason === 'idle' ? '/login?reason=idle' : '/login');
  }

  useIdleLogout(() => handleLogout('idle'), signedIn);

  function navLink(item: { href: string; icon: string; label: string }) {
    const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] mb-0.5 ${
          active ? 'bg-surface-2 text-gold-light border-l-2 border-gold' : 'text-text-2 hover:bg-surface-2'
        }`}
      >
        <span className="w-4 text-center text-xs opacity-85">{item.icon}</span>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        />
      )}
      <aside
        className={`w-58 flex-none bg-surface border-r border-surface-2 flex flex-col overflow-y-auto fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-surface-2 flex items-center gap-2.5">
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#1B5E20" strokeWidth="3" />
            <text x="50" y="63" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="46" fill="#3F7D32">
              C
            </text>
          </svg>
          <span className="leading-tight">
            <span className="block font-serif italic text-gold-light text-sm">ChrisPa Scents and Soaps</span>
            <span className="block text-[8.5px] tracking-[0.18em] text-text-2">NATURAL WELLNESS</span>
          </span>
        </div>
        <nav className="p-2.5 flex-1">
          {sections.map((section, i) => {
            const open = !!openSections[section.key];
            return (
              <div key={section.key} className={i > 0 ? 'mt-3' : ''}>
                <button
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-gold-dark hover:text-gold-light"
                >
                  {section.title}
                  <span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                </button>
                {open && section.items.map(navLink)}
              </div>
            );
          })}
        </nav>
        {signedIn && (
          <button
            onClick={() => handleLogout()}
            className="flex items-center gap-2.5 px-2.5 py-2 m-2.5 rounded-md text-[12.5px] text-danger hover:bg-surface-2 text-left"
          >
            <span className="w-4 text-center text-xs opacity-85">⏻</span>
            Log Out
          </button>
        )}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 flex-none border-b border-surface-2 flex items-center gap-3 px-4 sm:px-5.5 bg-gradient-to-b from-[#F7FAF4] to-white">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
            className="lg:hidden flex flex-col justify-center gap-1.5 w-8 h-8 flex-none"
          >
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
          </button>
          <div className="text-[11.5px] text-text-2 truncate">
            ChrisPa Admin / <b className="text-gold-light">{current?.label ?? 'Admin'}</b>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
