# 06. API Design and Documentation

## Style and conventions

- REST over HTTP/JSON, versioned under a single global prefix: **`/api/v1`** (`app.setGlobalPrefix` in
  `main.ts`) — no per-resource versioning yet, appropriate at pre-v1-consumer scale.
- Request bodies are validated and whitelisted by a global `ValidationPipe`
  (`whitelist: true, transform: true, forbidNonWhitelisted: true`) driven by `class-validator`/
  `class-transformer` DTOs in each module's `dto/` folder — unknown fields are rejected outright rather than
  silently dropped, so a DTO's shape is the actual contract.
- Auth: JWT bearer tokens (`Authorization: Bearer <token>`), see
  [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md).
- CORS is restricted to `CORS_ORIGINS` (env-configured; currently the two local frontend ports) with an
  explicit method list — see [`04-backend-development.md`](./04-backend-development.md) for why the method
  list is explicit.

## Route surface (by controller prefix, from `apps/api/src/modules`)

| Prefix | Module | Access |
|---|---|---|
| `/health` | health | Public |
| `/auth`, `/auth/webauthn` | auth | Public (login/register/refresh) + self |
| `/catalog` | catalog | Public (read) |
| `/cart` | cart | Authenticated customer |
| `/checkout` | checkout | Authenticated customer |
| `/orders` | orders | Authenticated customer (own orders) |
| `/wishlist` | wishlist | Authenticated customer (own) |
| `/account/addresses` | addresses | Authenticated customer (own) |
| `/account/payment-methods` | payment-methods | Authenticated customer (own) |
| `/account/profile` | profile | Authenticated customer (own) |
| `/account/settings` | account-settings | Authenticated customer (own) |
| `/support/tickets` | support | Authenticated customer (own tickets — list/create/view thread/reply) |
| `/admin/support/tickets` | support (admin) | `OWNER`, `STORE_MANAGER`, `SUPPORT_AGENT` — review, respond, change status (FR-7.4) |
| `/chat/message` | chat | Public — "ChrisPa Agent" (FR-7.1), local keyword-matched FAQ bot, app-wide throttle only |
| `/loyalty` | loyalty | Authenticated customer (own) |
| `/cms` | cms | Public (read) |
| `/admin/social-links` | cms (admin) | `OWNER`, `STORE_MANAGER` — full CRUD on social media accounts (FR-19.2) |
| `/admin/pages`, `/admin/banners` | cms (admin) | `OWNER`, `STORE_MANAGER` — full CRUD on Static Pages / Banners (FR-27.1) |
| `/admin/products` | catalog (admin) | `OWNER`, `STORE_MANAGER` |
| `/admin/orders` | orders (admin) | `OWNER`, `STORE_MANAGER`, `FULFILLMENT` |
| `/admin/inventory` | inventory | Staff (read-heavy, per role) |
| `/admin/customers` | crm | Staff |
| `/admin/marketing` | marketing | Staff |
| `/newsletter` | marketing (public) | Public — `POST /subscribe`, `POST /unsubscribe` (FR-1.6/FR-26.4) |
| `/account/notifications` | account-notifications | Authenticated customer (own) — `GET /`, `GET /unread-count`, `POST /:id/read`, `POST /read-all` (FR-26.4) |
| `/admin/users` | admin-users | `OWNER` |
| `/admin/activity-log` | activity-log (common) | `OWNER` |
| `/admin/finance/entities`, `/admin/finance/accounts`, `/admin/finance/journal-entries`, `/admin/finance/periods`, `/admin/finance/intercompany`, `/admin/finance/reports`, `/admin/finance/expenses` | finance | `OWNER` |
| `/admin/vendors` | marketplace | `OWNER`, `STORE_MANAGER` |
| `/admin/payments/transactions` | payments (admin view) | `OWNER`, `STORE_MANAGER` |
| `/payments/flutterwave/webhook` | payments (gateway) | Public, `verif-hash`-signature-verified |
| `/hr`, `/hr/employees`, `/hr/departments`, `/hr/attendance`, `/hr/leave-requests`, `/hr/shifts`, `/hr/payroll`, `/hr/advances`, `/hr/dashboard` | hr (oversight) | `OWNER`, `HR_MANAGER` |
| `/hr/me`, `/hr/me/profile`, `/hr/me/attendance`, `/hr/me/leave-requests`, `/hr/me/shifts` | hr (self-service) | Any authenticated staff user with a linked `Employee` |

RBAC is enforced by `RolesGuard` + `@Roles()` reading `UserRole` (`OWNER`, `STORE_MANAGER`, `FULFILLMENT`,
`SUPPORT_AGENT`, `HR_MANAGER`, `CUSTOMER`) — this table is a summary; the guard decorators on each controller
are the authoritative access rule.

## API documentation format

**No machine-readable API spec exists yet** — no Swagger/OpenAPI (`@nestjs/swagger`), no generated Postman
collection, no `openapi.yaml`. The template's "API Design and Documentation" requirement is currently
satisfied only informally: DTOs are the contract, and `docs/SRS.md` documents intent per FR-ID. This is the
most concrete, low-effort gap to close in this document set — adding `@nestjs/swagger` decorators to
existing DTOs and serving `/api/v1/docs` would take a few hours and cost nothing architecturally, since Nest
generates the spec from the same class-validator DTOs already in place.

## Error format

Nest's default `HttpException` JSON shape: `{ statusCode, message, error }`. No custom envelope
(`{ data, error, meta }` wrapper, request ID field, etc.) has been adopted — consistent across the codebase
today, so introducing one later is a breaking change to plan deliberately rather than one to make casually.

## Payment/checkout API scope note

`POST /checkout` completes `CASH_ON_DELIVERY` immediately, same as before. `MOBILE_MONEY`/`CARD` (docs/SRS.md
§21 PAY-FR-1) now create the order the same way and additionally return a real Flutterwave hosted-checkout
`checkoutUrl` (requires `returnUrl` in the request body) — no longer a `501`. This has not been exercised
against a live Flutterwave sandbox in this session (no real credentials were provided); it fails cleanly with
a `500` and an actionable message if `FLUTTERWAVE_SECRET_KEY` is still the placeholder value in
`apps/api/.env`. `POST /account/payment-methods` still rejects `CARD` with `501` — this API deliberately never
accepts a raw card number itself (Flutterwave's hosted checkout handles that instead), since there is no
PCI-DSS-compliant flow for ChrisPa's own servers to take one directly.

## Customer order-receipt confirmation

`PATCH /orders/:id/confirm-receipt` (docs/SRS.md PAY-FR-5, §21.5) is the customer-facing `OrdersController`'s
first (and only) write endpoint — previously `GET`-only. Ownership-checked (`404` if the order isn't the
caller's), and only legal once (`400` if the order isn't yet `DELIVERED`, or was already confirmed). Sets
`Order.deliveryConfirmedAt`, which the customer's printable receipt gates on.

On the admin side, `GET /admin/orders` gained a `?confirmed=true` filter (`deliveryConfirmedAt: { not: null }`)
so staff can list exactly the orders whose customers have confirmed receipt, and `GET /admin/orders/counts`
now returns an additional `CONFIRMED` count alongside the per-status ones.

## Social media accounts

`GET /cms/social-links` (docs/SRS.md FR-19.2, public, active links only, sorted) is what the storefront
footer and Account → Connected & Social both read — the first genuinely admin-writable piece of the `cms`
module (`/admin/social-links`, full CRUD, `OWNER`/`STORE_MANAGER`). Deleting a link, or just `PATCH`ing
`isActive: false`, removes it from both storefront surfaces immediately — there's no separate publish step.

## Newsletter signup

`POST /newsletter/subscribe` / `POST /newsletter/unsubscribe` (docs/SRS.md FR-1.6/FR-26.4, public, no auth —
same shape as the `/cms` public reads, but a write) back the storefront footer's newsletter box, previously
a static `your@email.com` placeholder. Both are idempotent regardless of prior state and always return the
same success shape (`{ subscribed: true }` / `{ subscribed: false }`) so the response can't be used to probe
which emails are already on the list. Admin side reuses the existing `marketing` module and role set:
`GET /admin/marketing/newsletter-subscribers` (`OWNER`/`STORE_MANAGER`/`FULFILLMENT`, same as
`/coupons`/`/bundles`) lists active subscribers newest-first.

**Campaign sending is real.** `POST /admin/marketing/newsletter/send` (`OWNER`/`STORE_MANAGER` only, body:
`{ subject, body }`) emails every active subscriber via the shared `MailService` (best-effort,
`Promise.allSettled`; logs a warning instead of sending if SMTP isn't configured — see
`07-authentication-and-authorization.md`) and creates an `AccountNotification`-visible `Notification` row
(`type: NEWSLETTER`) for any subscriber whose email matches a `User`. Both the email and the notification
include a "Follow ChrisPa" block built from `GET /cms/social-links`'s active rows. Each send is recorded as a
`NewsletterCampaign`, listed via `GET /admin/marketing/newsletter/campaigns` (same role set as the reads
above). See FR-26.4 for the full description.

## CMS pages & banners

`/admin/pages` and `/admin/banners` (docs/SRS.md FR-27.1) followed the same pattern — full CRUD,
`OWNER`/`STORE_MANAGER`. Two new public reads back them: `GET /cms/pages/:slug` (a single `PUBLISHED` page —
previously only the list, `GET /cms/pages`, existed) and the already-existing `GET /cms/banners` (active
banners, sorted), now actually consumed by the storefront homepage hero instead of going unused. Banner image
upload reuses `POST /admin/products/media/upload` rather than a separate endpoint — the same 5MB/JPEG-PNG-
WEBP-GIF constraints apply. `Blog Posts` remains the one CMS-domain read endpoint (`GET /cms/blog`) with no
admin write side.
