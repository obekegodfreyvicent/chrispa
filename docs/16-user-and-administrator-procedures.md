# 16. User and Administrator Procedures

Practical runbook for the operations this platform actually supports today — not a template adaptation, a
direct reference grounded in the implemented modules.

## First-time local environment setup

```
npm install
docker compose up -d
cp apps/api/.env.example apps/api/.env      # fill in real secret values
npm run prisma:migrate
npm run db:seed
```

Seeded staff logins (all password `ChrisPa2026!`):

| Email | Role |
|---|---|
| `chris@chrispa.ug` | `OWNER` |
| `patricia@chrispa.ug` | `STORE_MANAGER` |
| `dennis@chrispa.ug` | `FULFILLMENT` |
| `grace@chrispa.ug` | `HR_MANAGER` |
| `brenda@chrispa.ug` | `SUPPORT_AGENT` |

Seeded customer: `sarah@example.com` (Gold-tier loyalty, `ChrisPa2026!`).

**`chris`, `patricia`, and `grace` require a TOTP code, not just the password** — `seed.ts` enables 2FA for
those three, and login will stop at a code prompt with no way to produce one until a real secret is enrolled
(see the seed-data gap in [`03-database-design.md`](./03-database-design.md) and the Two-factor authentication
section of [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)). In the live
production database this has already been done — those three accounts have real TOTP secrets, delivered to
the account owner directly, not written down here. `dennis` and `brenda` have 2FA off and log in with just the
password above.

## Logging into the live deployment

The production URLs are `https://chrispa-storefront.netlify.app` (customer storefront) and
`https://chrispa.netlify.app` (admin console), backed by the API at
`https://chrispa-api.onrender.com/api/v1` — see
[`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md) for the
full deployment configuration. **Registering a new customer account in production will not work yet** —
neither verification code is actually delivered (see [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)
and incident #2 in [`13-incident-response-and-troubleshooting.md`](./13-incident-response-and-troubleshooting.md))
— use the seeded `sarah@example.com` account to exercise the customer experience until that's fixed.

## Granting a staff member admin console access

1. `OWNER` or `HR_MANAGER` creates or already has an `Employee` record (HR → Employees).
2. Grant a login via `POST /hr/employees/:id/create-login` (or set `loginEmail`/`loginRole` at creation
   time) — this generates a **one-time temporary password**, returned once in the API response only.
3. Hand that password to the employee out-of-band (there is no email/SMS delivery — see
   [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)). Do not log or
   store it anywhere else.
4. The employee's first login is forced through `/change-password` (`mustChangePassword: true`) before any
   other admin action is allowed.
5. Only an `OWNER` can grant the `OWNER` role — `HR_MANAGER` will be rejected with a `ForbiddenException` if
   it tries.
6. This is also how a **driver** account is created (`loginRole: 'DRIVER'`) — no separate onboarding flow for
   the Driver App (per user request, not in the original SRS; see
   [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)). See "Assigning and
   tracking deliveries" below for what happens after.

## Revoking access

- Set the employee's login to a non-functional state by disabling/removing the associated `User` role
  access as appropriate, or terminate the employee record (`employmentStatus: TERMINATED`) — **employee
  records are never hard-deleted**, matching the legal/compliance retention reasoning already used for
  orders.
- Logout revokes only the current session's refresh token; if broader revocation is needed (e.g. suspected
  compromise), all of that user's refresh tokens should be invalidated — confirm the current `AuthService`
  supports a "revoke all sessions" action before relying on it; if not, this is a gap worth flagging as
  follow-up work.

## Resetting a forgotten password (self-service)

`/auth/change-password` requires knowing the current password — there is no working forgot-password email
flow yet. This is no longer blocked on a missing delivery provider — `MailService`/`SmsService` are real and
already used for registration OTP (see [`07`](./07-authentication-and-authorization.md)) — forgot-password
just hasn't been wired to them. Until that exists, a forgotten staff password must be reset by an
`OWNER`/`HR_MANAGER` re-issuing a temp password through the create-login flow above.

## Common admin console operations

| Task | Where | Role required |
|---|---|---|
| Create/edit/archive a product | Admin → Products | `OWNER`, `STORE_MANAGER` |
| Transition an order's status | Admin → Orders | `OWNER`, `STORE_MANAGER`, `FULFILLMENT` |
| View inventory / low-stock | Admin → Inventory | Staff (read) |
| View coupons/bundles/newsletter subscribers (creating/editing a coupon or bundle isn't built yet) | Admin → Marketing | Staff |
| Compose &amp; send a newsletter (email + in-app notification, with follow-us links) | Admin → Marketing → Compose Newsletter | `OWNER`, `STORE_MANAGER` |
| Add/edit/remove a social media account, page, or banner | Admin → CMS / Site Builder | `OWNER`, `STORE_MANAGER` |
| Approve/reject leave | Admin → HR (oversight) → Leave Requests | `OWNER`, `HR_MANAGER` |
| Run payroll for a period | Admin → HR → Payroll | `OWNER`, `HR_MANAGER` |
| Clock in/out, request leave (self) | Admin → My HR | Any authenticated staff user with a linked `Employee` |
| Edit department permission policy | Admin → HR → Departments → Policy & Permissions | `OWNER`, `HR_MANAGER` (record-only — see note below) |
| Review customer/staff activity log | Admin/Backend → Activity Log | `OWNER` only |
| Post a journal entry / view financial statements | Financial & Accounting (own top-level nav section) | `OWNER` only |
| Manage marketplace vendors, compute a payout, record an expense | Financial & Accounting → Vendors / Expenses | `OWNER` (`STORE_MANAGER` for `/admin/vendors` at the API level) |
| Assign a vendor / set cost basis on a product | Admin → Products (Add/Edit Product form) | `OWNER`, `STORE_MANAGER` |
| Print/view an order's receipt | Admin → Orders → an order → View / Print Receipt | `OWNER`, `STORE_MANAGER`, `FULFILLMENT` |
| Review/respond to a support ticket, change its status | Admin → Support Tickets | `OWNER`, `STORE_MANAGER`, `SUPPORT_AGENT` |
| Assign/reassign a driver to an order | Admin → Orders → an order → Delivery / Driver | `OWNER`, `STORE_MANAGER`, `FULFILLMENT` |
| Work an assigned delivery (pickup/delivery, GPS) | Admin → My Deliveries | `DRIVER` (own assigned deliveries only) |

## Assigning and tracking deliveries (Driver App)

Added this session (commit `75b7cff`), per user request — not in the original SRS. Scoped deliberately lean:
the driver app is a section inside the existing admin console (not a separate application), and "GPS
navigation" means capturing coordinates + deep-linking to Google Maps, not an in-app map/routing engine — see
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) if a fuller in-app map is
ever reconsidered.

**Admin side**:
1. Create a driver account via the normal staff-login flow above (`loginRole: 'DRIVER'`).
2. Open the order in Admin → Orders → an order, and use the **Delivery / Driver** card to assign (or
   reassign) a driver from the dropdown. Reassigning an in-progress delivery restarts its own status
   lifecycle (back to `ASSIGNED`) — it does **not** move `Order.status` backward.
3. Watch the same card for live status, pickup/delivery timestamps, and Google Maps links as the driver
   works the delivery — no separate "track a driver" page, it's on the order itself.
4. Both the admin and customer printable receipts (View / Print Receipt) show the driver's name, pickup
   time+location, and delivery time+location once set — this was the actual point of the request ("all
   information in a driver app should appear in receipt for both customer and admin").

**Driver side** (Admin → My Deliveries, only visible/usable by `DRIVER`-role accounts):
1. See assigned deliveries, grouped Active / Completed.
2. Open one to see the pickup location (warehouse) and delivery destination (customer address), each with a
   "Open in Google Maps" link for actual turn-by-turn directions.
3. Advance through the lifecycle with one button at a time: *heading to pickup → picked up → heading to
   customer → delivered*. The **picked up** and **delivered** steps require sharing the browser's current
   location (`navigator.geolocation`) — the button is blocked with a clear error if location access is
   denied, since those two moments are exactly what gets snapshotted onto the receipt.
4. A "Share my current location" button is available while en route, for a manual live-position update — not
   automatic/continuous tracking (no background-location permission is requested; that would need a native
   app, not a browser tab).
5. "Report a problem / mark as failed" is available from any in-progress state, for a delivery attempt that
   couldn't be completed (customer unreachable, refused, etc.) — terminal, same as `DELIVERED`, no further
   transitions.

Marking **picked up** auto-advances `Order.status` to `SHIPPED` and **delivered** to `DELIVERED` (stepping
through `PROCESSING` first if staff hadn't already moved it there — a driver being assigned before an order
leaves `PENDING` is normal, not an error). This reuses the exact same `OrdersService.updateStatus()` staff
already use from the Orders page, so revenue recognition and the rest of the order pipeline behave
identically regardless of whether a driver or a staff member triggered the transition.

## Customer receipts require the customer's own confirmation first

`docs/SRS.md` PAY-FR-5 (§21.5). A customer's own receipt link (storefront → Order Tracking → an order → View
/ Print Receipt) only appears once staff have set the order to **Delivered** — and even then, following it
first lands on a **"Confirm Your Order"** prompt, not the receipt itself, until the customer clicks
**"✓ I received my order in good condition."** This is intentional: the receipt represents both sides agreeing
the order is genuinely complete (staff's `DELIVERED` status **and** the customer's own confirmation), not just
staff's side of it. If a customer contacts support asking why they can't see their receipt yet, the answer is
almost always "they haven't clicked Confirm yet" — there's no admin override to unlock it early, since it's
specifically the customer's own attestation. Staff can always view the order's receipt regardless (Admin →
Orders → an order → View / Print Receipt, no confirmation required) — it's the same document the customer
gets (same heading, same layout, same figures), showing a "customer has not yet confirmed receipt" line, or
the same "received in good condition" stamp the customer sees, once they have.

**Finding confirmed receipts without opening every order**: Order Management's list has a **Receipt** column
(a green "✓ Confirmed" chip once the customer has, "Awaiting confirmation" for a Delivered order that hasn't
been yet, a dash for anything earlier) and a **"✓ Receipt Confirmed (N)"** filter chip next to the status
tabs — click it to see only the orders whose customer has confirmed, i.e. the ones with a finalized, stamped
receipt worth keeping a copy of. The order detail page shows the same confirmation line (with the date) right
next to the status badge, before you even open the receipt.

## Publishing a product to the storefront

Two things trip people up here, both fixed to be clearer rather than requiring tribal knowledge:

- **Status must be Active.** A new product defaults to **Draft** — this is deliberate (review-before-publish),
  not a bug, but it means a product a staff member just created won't appear on the storefront until its
  Status is switched to **Active** in the Add/Edit Product form. The form now shows an inline reminder
  ("Only Active products appear in the storefront Shop…") whenever Status isn't Active, so this shouldn't be
  a surprise anymore.
- **Photos**: "+ Attach / Upload Photo" on the product form uploads a real file and now **actually renders**
  on the storefront — both the Shop grid and the product detail page's main image/thumbnails show the real
  uploaded photo, not a placeholder (previously a real gap: uploads worked, but nothing on the storefront
  displayed them).

On the customer side, **Shop** in the header now opens a general `/shop` page listing every active product
across all lines (previously hardcoded to link straight to the Candles line specifically) — with a
**Categories** sidebar (every line, "All Products", current one highlighted) on both `/shop` and every
`/shop/[line]` page, so switching categories never requires going back to the homepage. A **search box** in
the header (desktop and mobile) is now also always available — it searches product name, scent/flavor notes,
and health benefits, and submits to `/search?q=…`, a results page built on the same Shop layout.

**Account / Log In consolidation**: the storefront header used to show a separate **Log In** link alongside
**Account** for a signed-out visitor. That standalone Log In link is gone — **Account** is the one entry point
now, and it always goes to `/account`, signed in or not. Signed out, `/account` shows **only** **Log In** and
**Create an Account** as two separate, fully working forms side by side (each with a line of plain-language
guidance on who it's for) — nothing else on the page, and no Account sub-section sidebar next to them (that
sidebar has nothing to show yet for a visitor with no account, so it's hidden entirely, not just deprioritized,
until they sign in) — instead of redirecting to the standalone `/login` page, so a new or returning customer
never leaves the normal storefront page (header/footer intact) just to sign in. Submitting either form signs
the customer in and reloads the page in place, landing on the real Account Overview dashboard with its sidebar
back. The standalone `/login` and `/signup` pages still exist for anything that links to them directly (e.g.
`/forgot-password`'s flow); `/account` is an additional, more discoverable entry point, not a replacement.
**Log Out** is unchanged, still shown once signed in.

## Managing CMS content (Social Media Accounts, Pages, Banners)

`docs/SRS.md` FR-19.2/FR-27.1. Admin → **CMS / Site Builder** has three panels with real write access
today — Blog Posts is the one CMS-domain area left as a read-only status view. Every add/edit/delete across
all three is recorded to the Activity Log.

**Social Media Accounts** — backs both storefront surfaces at once: the footer's "Follow ChrisPa" row and
Account → Connected & Social's "Follow ChrisPa Scents and Soaps" card, which previously showed two separately
hardcoded, inconsistent lists of non-clickable labels.

- **Add**: click **+ Add Account**, enter a Platform name (anything — Instagram, Facebook, TikTok, WhatsApp,
  Pinterest, X, YouTube, whatever's needed, no fixed list) and the full URL, then **Save**. It appears on both
  storefront surfaces immediately — no publish step.
- **Edit**: click **Edit** to change its platform label, URL, or display order.
- **Show/hide without deleting**: click the **Active**/**Hidden** chip on the left of any row — useful for
  temporarily pulling a link without losing its details.
- **Remove**: click **Remove** (confirms first) — deletes it outright.

**Published Pages** — a real page publishes to `/pages/[slug]` on the storefront the moment it's saved as
**Published** (a plain title-and-text view, no rich-text formatting).

- **Add**: click **+ Add Page**, enter a Title (the URL slug auto-generates from it — e.g. "About ChrisPa"
  becomes `/pages/about-chrispa` — or type your own), the page content, and a Status.
- Click the **Draft**/**Published** chip on any row to flip it directly, without opening Edit.
- **Edit** to change the title, slug, content, or status; **Delete** removes it outright (the storefront
  route then 404s).

**Active Banners** — the lowest-display-order **Active** banner becomes the storefront homepage's hero image,
replacing the placeholder that showed before any banner existed. This isn't a multi-slide carousel — only one
banner shows at a time, whichever has the lowest Order among the active ones.

- **Add**: click **+ Add Banner**, then **Upload Image** (same real upload — JPEG/PNG/WEBP/GIF, 5MB max — as
  product photos, not a pasted URL), optionally a Link URL (an in-app path like `/shop/candles`, or a full
  external URL), and a display Order, then **Save**.
- Click the **Active**/**Hidden** chip to pull a banner without deleting it (e.g. an out-of-season promo).
- **Edit** to replace the image, change its link or order; **Remove** to delete it outright.

## Using Financial & Accounting Management

**Financial & Accounting** is its own top-level nav section in the admin console sidebar — alongside
Admin/Backend, Human Resources, and My HR — not an item nested inside Admin/Backend. It was moved there at
the user's explicit request, to mirror how Human Resources / My HR are already separate sections; the section
is hidden entirely for every role but `OWNER` (`visibleSections()` in `admin-shell.tsx`), matching the
`OWNER`-only API guard on every `/admin/finance/*` endpoint. Tabs within the section:

- **Entities** — view the group tree; create a new legal entity (name, code, functional currency, parent,
  FX rate to the group reporting currency). A new entity automatically gets the standard chart-of-accounts
  template applied, so it can post journal entries immediately.
- **Chart of Accounts** — the selected entity's accounts (code, name, type, intercompany flag).
- **Journal Entries** — the selected entity's posted entries, and a form to post a new one. Lines must
  balance (total debits = total credits) before the "Post Entry" button enables — the API enforces this too,
  so a client-side bug here can't actually corrupt the ledger.
- **Reports** — Balance Sheet, Income Statement, and Cash Flow Statement, for either the selected entity
  alone or **Consolidated (group)**, over a chosen date range. The balance sheet shows a "Balanced"/"Out of
  balance" indicator; a consolidated one also shows the intercompany amounts eliminated.
- **Intercompany** — allocate a management fee from the group parent to a subsidiary (posts the matched pair
  of journal entries in one step), and view each entity's due-to/due-from balances by counterparty.

**What this doesn't do**: no period-close workflow (periods stay `OPEN` until explicitly closed via the API —
no UI button for it yet), no live FX rates (entity FX rates are set manually at entity creation/edit), and no
tax/GAAP/IFRS-specific reporting. See `docs/SRS.md` §20 for the full list of documented simplifications. This
is a real bookkeeping engine, not a substitute for an accountant's review before real financial statements are
filed, audited, or relied upon.

## Using Marketplace, Payments & Tax

`docs/SRS.md` §21. Two more tabs live in the same **Financial & Accounting** section:

- **Vendors** — create a vendor (name, contact info, payout Mobile Money number, commission %); assign a
  vendor to a product from the Product Manager's Add/Edit form (a new "Vendor" field there, alongside the new
  "Cost (UGX)" field used for COGS). "Compute Vendor Payout" aggregates a vendor's delivered, not-yet-paid
  sales in a date range into a payout record; "Mark Paid" is a manual step — **there is no real Mobile Money
  disbursement to the vendor**, this only records that ChrisPa paid them some other way.
- **Expenses** — record a server/hosting, software-license, marketing, or other operating expense against an
  entity; view the effect in Reports → Income Statement for that expense category's account.

**Uganda VAT (18%)** is applied automatically at checkout — no admin action needed — and shown as its own
line on every order, invoice, and in the ledger (credited to a VAT Payable liability, never revenue).

**Flutterwave (Mobile Money/Card) checkout**: real integration, but **not configured with live credentials in
this environment** — `apps/api/.env`'s `FLUTTERWAVE_SECRET_KEY`/`FLUTTERWAVE_PUBLIC_KEY`/
`FLUTTERWAVE_SECRET_HASH` are still placeholder values (see `.env.example`). Until real sandbox/live keys are
added there, a customer choosing Mobile Money or Card at checkout will see a clear "Flutterwave is not
configured" error rather than a working payment — this is expected, not a bug, until those keys are set.
Once configured, cancelling/refunding a DELIVERED order with a successful payment automatically triggers a
real Flutterwave refund call and reverses the corresponding ledger entries — no separate manual step.

## ChrisPa Agent (AI live chat) — no configuration needed

Support → **Live Chat** on the storefront (`docs/SRS.md` FR-7.1) is a real chat widget, not a placeholder —
appearing as an avatar-and-name persona, **"ChrisPa Agent"** (a circular badge styled after the site header's
logo mark, shown in the widget header and next to every reply — a rename + avatar treatment of what the
original wireframe called "Pa", per explicit user request).

**It's a basic, keyword-matched FAQ bot, not an LLM.** `ChatService.reply()` matches the visitor's message
against a fixed table of keywords (product lines, candle safety, shipping, returns, ingredient sourcing) and
returns a canned reply, or a fallback pointing at the "Submit a Ticket" form if nothing matches. This is
deliberate — an earlier version called the Claude API and needed a paid `ANTHROPIC_API_KEY`; per explicit
user decision that was replaced with this local keyword matcher specifically to need **no external service,
no credentials, and no ongoing cost**. There is nothing to configure — it works immediately in every
environment, with no setup step and no key to obtain.

Two things worth knowing operationally:

- **It's public** — any storefront visitor can chat with ChrisPa Agent, signed in or not (matching the
  wireframe's Live Chat card). No per-route rate limit beyond the app-wide default (100 req/min/IP) — the
  earlier tighter throttle existed only because each request was a billed external call, which no longer
  applies to a local keyword match.
- **It never sees customer/order/account data**, by explicit design — same boundary as the earlier LLM
  version, just enforced by an explicit keyword check now instead of a system-prompt instruction: anything
  sounding account-specific ("my order", "track", "password", etc.) gets a fixed reply pointing at the
  Submit a Ticket form rather than a guess.
- **Trade-off to be aware of**: keyword matching is much less flexible than an LLM — a question phrased
  differently from what's in the keyword table falls through to the generic fallback reply rather than a
  genuinely helpful answer. If richer conversation is wanted later, re-adding the Claude API integration is
  a real option (the prior implementation is preserved in git history) — see `docs/SRS.md` FR-7.1.

## Reviewing and responding to support tickets

`docs/SRS.md` FR-7.4. A customer raises a ticket from the storefront's **Support** page (optional order #,
free-text issue); it appears under Admin → **Support Tickets** for `OWNER`/`STORE_MANAGER`/`SUPPORT_AGENT` to
work. The list mirrors Order Management's layout: status tabs (Open/In Progress/Resolved/Closed) with counts,
a search box (issue text, customer name/email), and a detail page per ticket.

- **Responding** posts a `TicketMessage` visible to the customer immediately on their own ticket-thread page
  (`/support/tickets/[id]`) — this is a real two-way conversation, not a one-shot reply. The customer can
  reply back from the same page as long as the ticket isn't `CLOSED`.
- **Every message in the thread shows the responding staff member's actual full name** (e.g. "Patricia A."),
  not a generic "Staff"/"ChrisPa Support" label — resolved from their `Employee` record, the same identity
  lookup the Activity Log uses (see below). This shows on both the admin console's thread view and the
  customer's own, and each message carries a date/time stamp.
- **The first staff reply to an `OPEN` ticket auto-advances it to `IN_PROGRESS`** — there's no separate "claim"
  button; replying is the claim.
- **Status** (Open / In Progress / Resolved / Closed) is a free choice for staff — no enforced transition
  order, unlike Order Management's fulfillment pipeline. **`CLOSED` is a hard stop**: neither the customer nor
  staff can post a new message until the ticket is moved to a different status first; the customer's page
  shows "raise a new ticket for further help" instead of a reply box once closed.
- Every status change and staff response is recorded to the Activity Log (`TICKET_STATUS_CHANGED`,
  `TICKET_RESPONDED`) — see the section below.

## Reviewing the activity log

Admin/Backend → **Activity Log** (`GET /admin/activity-log`, `OWNER`-only in both the nav and the API) shows a
unified, filterable feed of both customer and staff actions — logins, orders placed, product/order/employee
edits, staff logins granted. Each row shows the acting **person's full name** and, for staff with an HR
profile, their **department** — resolved at read time from the linked `Employee` record (falling back to the
login account's name for actors with no HR profile, e.g. customers). Filter by actor type
(Customer/Staff/System), action code (populated from what's actually been recorded, via
`GET /admin/activity-log/actions`), **department** (via `GET /admin/activity-log/departments`), a free-text
search over the description, or a date range; results are paginated. See `docs/SRS.md` §19 AL-FR-5 for how
the name/department resolution works.

**What it does not yet cover**: user/role changes and inventory adjustments have no admin write endpoint to
log against yet (see `docs/SRS.md` §19 AL-FR-2) — those categories will start appearing once those features
are built, not before. This is a representative audit trail across the write paths that exist today, not a
claim that every mutation in the system is captured.

Note: `DepartmentPermission` edits change a *documented policy record*, not actual enforcement — the real
access-control boundary is always the `@Roles()` decorator on the relevant controller. See
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md).

## Browser Back/Forward are intentionally disabled

If a customer or staff member reports that the browser's **Back** or **Forward** button "does nothing" on
either the storefront or the admin console, that is expected, current behavior — not a bug to file. It was
requested and confirmed as an explicit product decision, built against the SRS author's own recommendation
(a working Back/Forward is standard browser behavior, and removing it has a real usability/accessibility
cost). Pressing Back or Forward anywhere in either app simply keeps the visitor on the page they're already
on; clicking links, the header, or the admin sidenav navigates normally as always. See `docs/SRS.md` §6
("Navigation behavior") and `docs/05-frontend-architecture.md` for how this is implemented
(`NavigationTrap`, one copy per app) and why the first implementation attempt didn't work.

## Resetting the local database to a clean seeded state

```
cd apps/api && npx prisma migrate reset
```

**Destructive** — drops and recreates the database. Prisma's CLI requires explicit, freshly-given user
consent for an AI agent to run this
(`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set to the verbatim consent text) — never assume approval
carries over from earlier in a conversation, and always confirm with a human operator before running it
against anything but a disposable local database.
