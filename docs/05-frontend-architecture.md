# 05. Frontend / Application Architecture

Covers `apps/storefront` and `apps/admin` — both Next.js 16 (App Router), React 19, Tailwind v4.

## Route structure

Both apps use Next.js route groups to separate layout shells, matching the wireframes' distinct screen
types:

**Storefront** (`apps/storefront/src/app`):
- `(site)/` — the "real" storefront shell (header + footer): `shop`, `product`, `cart`, `checkout`,
  `orders`, `account`, `support`
- `(auth)/` — a minimal centered layout for standalone auth screens: `login`, `signup`, `forgot-password`,
  `reset-password`

**Admin** (`apps/admin/src/app`):
- `(admin)/` — the admin sidenav shell: `products`, `orders`, `inventory`, `customers`, `marketing`, `cms`,
  `hr`, `my-hr`, `settings`
- `login`, `change-password` — outside the `(admin)` group, unauthenticated/forced-flow pages with no
  sidenav

`hr` (oversight — restricted to `OWNER`/`HR_MANAGER`) and `my-hr` (self-service — open to any authenticated
staff user) are both visible in the nav to every admin user; the underlying pages 403/404 as appropriate
rather than hiding the nav item itself.

**The admin console's default page (`/`) redirects straight to `/login` for anyone not signed in** — per
explicit user decision, so the console's default/landing page functions as the admin login page rather than
showing dashboard chrome with an inline "please log in" prompt (every other admin page keeps that inline-prompt
pattern; this redirect is deliberately root-only). `DashboardPage` checks `getAccessToken()` in a mount effect
and calls `router.replace('/login')` when it's missing, rendering nothing itself in that case to avoid a flash
of dashboard content before the redirect fires — the same "cosmetic, not the real security boundary" caveat as
every other client-side auth check in this app (see
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)): the underlying
`/admin/*` API calls are still independently guarded server-side regardless of what this redirect does.

## Auth pattern (both apps)

`lib/auth-client.ts` in each app stores JWT access + refresh tokens in `localStorage`, set at login/signup.
This is a **deliberate dev-time simplification**, called out directly in that file — production should move
to httpOnly cookies set by a server-side route handler, since `localStorage` tokens are readable by any
script running on the page (XSS exposure). Not yet changed because there is no production deployment to
harden.

Key behaviors:
- `authedFetch()` wraps `fetch` with the bearer token and **auto-refreshes on a 401** — access tokens are
  short-lived (15 min) and there is no other recovery path, so without this, every write action would start
  silently failing partway through a session. Concurrent 401s collapse into a single shared refresh call
  (`inflightRefresh`) because the refresh token rotates on each use — firing two refreshes at once would
  invalidate each other.
- `logout()` calls the API (server-side revocation) before clearing local tokens, never throws, and always
  leaves the client logged-out even if the request fails.
- `getMustChangePassword()` / `getUserRole()` decode the JWT client-side (no verification — purely a UX
  shortcut) to drive redirects (`/change-password`, role-based nav visibility). Real enforcement is always
  server-side (`MustChangePasswordGuard`, `RolesGuard`) — see
  [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md).
- The storefront's `SiteHeader` reflects real auth state by checking `getAccessToken()` on mount, relying on
  the `(auth)`/`(site)` route-group split to remount the header after login/logout. There is no standalone
  "Log In" link — **Account** is the single entry point and always links to `/account`, signed in or not;
  **Log Out** is a separate control shown only once signed in. `(site)/account/page.tsx` itself branches on
  auth state: signed out, the page is *only* the Log In and Create Account forms (ported from `(auth)/login`
  and `(auth)/signup`, calling the same `/auth/login`/`/auth/register`/2FA/WebAuthn/`/auth/google` endpoints
  directly rather than linking out) — no dashboard content, no account sub-nav; signed in, it renders the
  dashboard as before. Both the standalone and embedded Log In/Create Account forms share two components
  from `components/auth/`: `GoogleSignInButton` (loads Google Identity Services' script, renders its own
  button, posts the resulting ID token to `POST /auth/google`; renders nothing if
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` isn't set) and `OtpVerify` (the two-channel email/phone code-entry step
  `register()`'s registration-OTP hard gate requires before an account can log in — see
  [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md) — reused for both a
  fresh signup and an existing account that never finished verifying, which `login()` reports as
  `{ requiresVerification: true, userId }`).
  `(site)/account/layout.tsx` independently runs the same `getAccessToken()`-on-mount check to decide whether
  to render its sub-section sidebar at all, so the sidebar is fully absent (not just visually secondary) while
  signed out, matching the page. Neither `SiteHeader` nor `AccountLayout` re-checks auth state on anything but
  mount, so a successful embedded login/register calls `window.location.reload()` rather than just updating
  local page state — a full reload is what gets the header, the now-restored sidebar, and the page's own
  dashboard branch all in sync in one shot. The standalone `(auth)/login` and `(auth)/signup` pages are
  unchanged and still reachable directly.

## Navigation behavior (both apps)

Per an explicit user decision — made against this document's own recommendation, since a working
Back/Forward is standard browser behavior and removing it has a real usability/accessibility cost
(bookmarking, muscle memory, screen-reader/keyboard workflows) — the browser's Back and Forward controls are
deliberately neutralized across the entire storefront and the entire admin console. Ordinary in-app
navigation (link clicks, the header, the admin sidenav) is unaffected; only a Back/Forward press is
neutralized, keeping the visitor on whatever page is currently displayed. This is built and documented as
intentional, not something a future reader should quietly "fix."

**There is no browser API to actually disable or hide the real toolbar buttons** — that's a hard security
boundary, not a gap here. What's implemented instead is a `NavigationTrap` client component
(`components/navigation-trap.tsx` — one copy per app, per the no-shared-package convention above, mounted
once in each app's root `layout.tsx`) that neutralizes the *effect* of a Back/Forward press:

- It listens for the browser's `popstate` event, which only ever fires from a genuine Back/Forward press (or
  `history.go()`) — never from a `<Link>` click, `router.push()`, or `router.replace()`.
- On `popstate`, it forces the page back to whatever was actually current via `window.location.replace(...)`
  — a real (if instant) navigation, not a second competing client-side transition.
- It tracks "what was actually current" by intercepting `history.pushState`/`replaceState` directly (every
  real navigation, including Next's own, goes through one of those), rather than via a React
  `usePathname()`/`useSearchParams()` ref updated in a `useEffect`. The React-ref version was the first
  attempt and it didn't work: Next.js App Router wraps its own `popstate` handling in `ReactDOM.flushSync()`
  (to avoid a flash of stale content during back/forward), and `flushSync` also forces pending passive
  effects to flush synchronously — so Next's own `popstate` listener (registered before the app's, so it
  always runs first) updated that ref to the *new*, unwanted page before `NavigationTrap`'s own listener ever
  read it. Confirmed via live instrumentation, not a guess. Tracking the History API directly sidesteps
  React's render/effect timing entirely, since a `popstate` never itself calls `pushState`/`replaceState`.

## Shared design tokens, not a shared package

Both apps' `globals.css` define the same Tailwind v4 `@theme` color tokens (`--color-gold`,
`--color-surface`, etc.), copied from the wireframes' CSS custom properties, so `bg-gold`, `text-gold-light`,
etc. work as utility classes in both apps. **There is no shared npm package** for these tokens or for
`auth-client.ts`/`api.ts` — each app keeps its own copy, matching the wireframes' "every file is fully
standalone" convention. This is a conscious trade-off (duplication over cross-app coupling for a two-app
monorepo), not an oversight — revisit only if a third frontend app is added or the duplication starts
causing real drift bugs.

## Data fetching

- `apps/storefront/src/lib/api.ts` centralizes storefront API calls.
- Admin has `use-refetch-on-focus.ts` (revalidate admin data when the tab regains focus — useful for a
  console multiple staff may use concurrently) and `use-idle-logout.ts` (session timeout for an
  internal/back-office tool).
- No client-side data-fetching library (React Query, SWR) is in use — fetching is done directly against
  `authedFetch()`/`api.ts` with component-local state.

## Next.js 16 caveat

This version has App Router API differences from older training data (typed `PageProps<'route'>` /
`LayoutProps<'route'>` helpers, async `params`/`searchParams`). Each app's `AGENTS.md` (auto-generated by
`next dev`/`next build`, safe to leave in git) points at `node_modules/next/dist/docs/` — check there before
assuming an older Next.js pattern still applies.

## Build and deployment

- `npm run build:storefront` / `npm run build:admin` produce standard Next.js production builds.
- **No containerization or hosting exists for either app yet** — see
  [`09-containerization-and-environments.md`](./09-containerization-and-environments.md) and
  [`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md).
