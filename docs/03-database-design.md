# 03. Database Design — PostgreSQL

Adapts template §9. Source of truth for the actual schema is always
`apps/api/prisma/schema.prisma` — this document explains conventions and current state, it does not
duplicate field-by-field detail (see `docs/SRS.md` §9 for the data-model narrative tied to FR-IDs, and
[`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md)/
[`23-data-dictionary.md`](./23-data-dictionary.md) for the full relationship table and field-by-field
reference this document deliberately doesn't grow to contain).

## Engine and access

- **Engine**: PostgreSQL 16 (`postgres:16-alpine`), run locally via `docker-compose.yml`, host port **5440**
  (not the default 5432 — this dev machine runs other projects' Postgres on the standard port).
- **Access**: through Prisma Client only. `apps/api/prisma.config.ts` configures the Prisma CLI (schema path,
  seed command) — Prisma 6+'s replacement for the deprecated `package.json#prisma` field — and explicitly
  calls `process.loadEnvFile()` since config-file mode disables Prisma's old auto-dotenv behavior for CLI
  commands.
- **Role model**: the local dev container uses a single `chrispa` role for both the application and
  migrations (`docker-compose.yml` / `.env.example`). The template's recommendation ("create separate
  database roles for applications rather than using a superuser") is **not applied today** because there is
  only one environment and one consumer of the database — revisit before a shared/staging database exists
  (a migration-runner role vs. an application role with least-privilege grants).

## Conventions (from `CLAUDE.md`, enforced throughout `schema.prisma`)

- UUID primary keys on every model.
- `@db.Timestamptz(3)` on every `DateTime` column — Prisma defaults to timezone-naive `timestamp` on
  Postgres, which this schema deliberately avoids.
- Explicit `@@index` on every foreign key not already covered by a `@unique`/`@@unique` — Prisma does **not**
  add these automatically on the `postgresql` provider, so they're written by hand.
- `Product.stockQty` / `Variant.stockQty` are **denormalized read caches, not the source of truth** —
  `InventoryRecord` (per product × warehouse) is authoritative. Nothing keeps the cached columns in sync yet
  (see the comment on `Product.stockQty` in the schema) — do not add logic that trusts them for a stock
  decision.

## Migrations

- Managed through Prisma Migrate: `npm run prisma:migrate` (wraps `prisma migrate dev`) applies pending
  migrations and generates a new one from any schema diff.
- Migration history lives in `apps/api/prisma/migrations/` and is committed to git — this **is** the
  template's "use migrations for schema changes" requirement, already satisfied.
- There is no separate staging/production migration step yet (no such environments exist) — today, `migrate
  dev` against the local database is the only migration path exercised.

## Seed data

`apps/api/prisma/seed.ts` is idempotent (built on `upsert`) and populates the real ChrisPa catalog/demo data:
5 product lines, 25 SKUs (24 `ACTIVE` + 1 `DRAFT`), 6 wellness tags, 2 warehouses with inventory records
(including the exact low-stock numbers from the Admin Inventory wireframe), 3 coupons, 1 bundle, 4 social
media accounts (Instagram/Facebook/TikTok/WhatsApp, clearly-placeholder handles — replace via Admin → CMS
once ChrisPa's real ones are known), 5 staff
users with matching `Employee` records (`chris@chrispa.ug` / `patricia@chrispa.ug` / `dennis@chrispa.ug` /
`grace@chrispa.ug` / `brenda@chrispa.ug`, password `ChrisPa2026!`), a 6th `Employee` with no linked login, 4
departments, one approved leave request, one completed clock-in/out cycle, one shift, and a sample Gold-tier
customer (`sarah@example.com`) with order history and a loyalty ledger.

Because `upsert`'s `update: {}` branches don't overwrite rows that already diverge (e.g. a hand-registered
test user), a clean slate requires `cd apps/api && npx prisma migrate reset` — **destructive**, requires the
user's explicit freshly-given consent, and Prisma's own CLI enforces this
(`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). Never assume consent carries over from earlier in a
conversation.

**Known seed-data gap — 2FA-locked demo accounts**: `seed.ts` sets `twoFactorEnabled: true` for
`chris@chrispa.ug`, `patricia@chrispa.ug`, and `grace@chrispa.ug` but never seeds a matching
`twoFactorSecret`, which — per [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md) —
permanently locks those three accounts out of login with no self-service or admin-side recovery path. A
**fresh** seed (e.g. after `prisma migrate reset && npm run db:seed`) reproduces this lockout on any machine,
local or production; it's not a production-specific issue, it's just easy to miss locally if an
already-diverged `chris` row from before the `twoFactorEnabled: true` change happens to already exist (`upsert`
won't touch it). The production database's three accounts were unlocked via a one-off bootstrap script — see
that section for the pattern — but `seed.ts` itself still produces this locked state as-is; fixing it at the
source (seeding a real secret, or defaulting these three to `twoFactorEnabled: false` like `dennis`/`brenda`)
has not been done.

**`User.suspendedAt`/`suspensionReason`** (added this session, commit `3b5fc6a`): a reversible,
admin-triggered account hold, distinct from the existing terminal `deletedAt` — see
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md) for the full feature and
[`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md) for exactly how it and `deletedAt`
interact with `AuthService.completeLogin()`/`refresh()`.

## Schema inventory (grouped by domain, from `schema.prisma`)

| Domain | Models |
|---|---|
| Identity & auth | `User`, `RefreshToken`, `WebAuthnCredential`, `LoginEvent` |
| Customer account | `Address`, `PaymentMethod` |
| Catalog | `ProductLine`, `WellnessTag`, `Product` (now with optional `vendorId`/`costUgx`), `ProductWellnessTag`, `ProductMedia`, `Variant` |
| Inventory | `Warehouse`, `InventoryRecord` |
| Cart & checkout | `Cart`, `CartItem`, `Order` (now with `vatUgx`, `deliveryConfirmedAt`), `OrderItem` (now with `vendorId`/`costUgxSnapshot`/`platformCommissionUgx`/`vendorPayoutUgx`/`vendorPayoutId`) |
| Marketplace | `Vendor`, `VendorPayout` — see below |
| Payments | `PaymentTransaction` — see below |
| Marketing | `Coupon`, `Bundle`, `NewsletterSubscriber` (FR-26.4 — footer email capture, not tied to `User`), `NewsletterCampaign` (one row per admin "Compose Newsletter" send) |
| Loyalty | `LoyaltyAccount`, `LoyaltyLedgerEntry` |
| Notifications | `Notification` (generic in-app notification center, `userId`-scoped; `NotificationType.NEWSLETTER` is the only type in use so far — see FR-26.4) |
| CRM / support | `Review`, `SupportTicket`, `TicketMessage`, `WishlistItem` |
| CMS | `CmsPage`, `Banner`, `BlogPost`, `SocialMediaAccount` |
| HR — org | `Department`, `DepartmentPermission`, `Employee`, `EmploymentHistoryEntry`, `EmployeeDocument` |
| HR — attendance/leave/shifts | `TimeEntry`, `LeaveRequest`, `Shift`, `ShiftSwapRequest` |
| HR — performance/recruitment | `PerformanceGoal`, `PerformanceFeedback`, `PerformanceReview`, `JobPosting`, `Applicant` |
| HR — payroll | `PayrollPeriod`, `Payslip`, `EmployeeAllowance`, `SalaryAdvance`, `PayslipAdvanceRepayment`, `PayrollAdjustment` |
| Activity log / audit trail | `ActivityLog` — see below |
| Financial & accounting (multi-entity) | `LegalEntity`, `GroupSettings`, `Account`, `FiscalPeriod`, `JournalEntry`, `JournalEntryLine`, `ExchangeRateHistory` — see below |

~30 enums back these models (`UserRole`, `OrderStatus`, `PayrollPeriodType`, etc.) — see the schema directly
for the authoritative list; enumerating them here would immediately drift out of sync.

## Activity log / audit trail

`ActivityLog` (docs/SRS.md §19) is the one model in this schema deliberately **without** a foreign key back
to `User` — `actorUserId`/`actorRole` are plain columns, snapshotted at write time, not a `@relation`. This
is intentional: an audit trail needs to survive independently of the row it describes (the same reasoning as
"Delete Account" scrubbing-not-deleting `User`), and a plain column means a log write can never fail or
block on a since-anonymized actor. Written via `ActivityLogService.record()`
(`apps/api/src/common/activity-log`), which accepts the same optional transaction-client parameter used
throughout this codebase (see `CatalogService.getByIdForAdmin()`) so it can log atomically inside an
already-open `$transaction`, and is deliberately best-effort — a logging failure never rolls back or fails
the business operation it's describing.

## Support tickets

`docs/SRS.md` FR-7.4. `TicketMessage` (one row per reply, either side) is a real threaded conversation on a
`SupportTicket`, not a single overwritable response field — `TicketStatus` already includes `IN_PROGRESS`,
implying back-and-forth before resolution. `TicketMessage.authorRole` is snapshotted at write time, the same
reasoning as `ActivityLog.actorRole` above: a later role change shouldn't rewrite how a past message rendered
(customer bubble vs. staff bubble). No enforced status-transition graph (unlike `Order.status`'s FR-23
pipeline) — a ticket's status has no comparable inventory/loyalty side effects gating it — except that
`CLOSED` is a hard stop: `SupportService` rejects a new `TicketMessage` from either side once a ticket is
`CLOSED`, until staff move it to a different status. `authorUserId` itself, like `ActivityLog.actorUserId`,
is resolved into a display name at **read time**, not stored redundantly — `SupportService.attachAuthorNames()`
prefers the linked `Employee` record's name over the login account's `User.name`, the same identity-resolution
pattern `ActivityLogService.enrichWithActorIdentity()` uses above.

## CMS admin writes — Social Media Accounts, Pages, Banners

`docs/SRS.md` FR-19.2/FR-1.6/FR-27.1. Three of `CmsService`'s models now have a real admin write side, all
`OWNER`/`STORE_MANAGER`, all Activity-Log-recorded — every other CMS-domain model (`BlogPost`) stays
read-only.

- **`SocialMediaAccount`** follows `Banner`'s `isActive`/`sortOrder` shape rather than `CmsPage`/`BlogPost`'s
  draft/published `CmsStatus` — a social link is either shown or it isn't, there's no separate "draft"
  concept for it. `platform` is a plain string, not an enum, specifically so an admin can add any platform
  without a schema change — this codebase has no icon library, so it always renders as a text label
  regardless of which platform it is. One admin-managed table backs two storefront surfaces (the footer and
  Account → Connected & Social) via a single public endpoint, `GET /cms/social-links` (active links only,
  sorted) — previously these were two separately hardcoded, inconsistent lists of non-clickable labels.
- **`CmsPage`** writes (`/admin/pages`) reuse the exact same collision-handled slugify as products
  (`CatalogService.uniqueSlug()`, duplicated as `CmsService.uniquePageSlug()` rather than shared, matching
  this codebase's "every file fully standalone" convention) — `slug` auto-derives from `title` if omitted on
  create. A `PUBLISHED` page is publicly readable at both `GET /cms/pages/:slug` and the storefront route
  `/pages/[slug]` — previously `CmsPage` had no per-page public read endpoint at all, only the list.
- **`Banner`** writes (`/admin/banners`) reuse the existing generic image-upload endpoint,
  `POST /admin/products/media/upload` (same allowed types/5MB cap as product photos), rather than a
  duplicate banner-specific upload path. The storefront homepage hero now renders the lowest-`sortOrder`
  active banner (previously a static placeholder image) — `linkUrl` is a plain string, not `@IsUrl`, since it
  can be a relative in-app path (e.g. `/shop/candles`), not just an absolute URL.

## Financial & accounting (multi-entity)

`docs/SRS.md` §20 (FIN-FR-*). Real double-entry bookkeeping, not a stub — see `apps/api/src/modules/finance`.
Two design choices worth knowing:

- **Money fields use `Decimal(18,2)` (via Prisma's `Decimal` type), not `Int`** — unlike the rest of this
  schema, which is UGX-only and uses `Int` (e.g. `Product.priceUgx`). A multi-currency ledger must not round
  through JS floats or assume a single currency's subunit conventions, so `JournalEntryLine.debitAmount`/
  `creditAmount` and `LegalEntity.currentGroupFxRate` are all `Decimal`.
- **`LegalEntity` is a self-referencing tree** (`parentEntityId`), not a fixed parent/subsidiary pair — the
  row with `parentEntityId: null` is the group's ultimate parent. Every entity keeps its own chart of
  accounts (`Account`) and journal (`JournalEntry`/`JournalEntryLine`), and every entity in the group is
  seeded with an **identical chart-of-accounts template** (same codes) specifically so consolidation can sum
  by account code without a separate cross-entity mapping table — a documented simplification, not a
  general solution for entities with genuinely divergent local charts of accounts.

`FiscalPeriod` (open/closed, per entity per month) gates which periods can still accept postings — the same
integrity purpose as HR's `PayrollPeriod` lifecycle. `JournalEntry.intercompanyGroupId` links the matched
pair of entries an intercompany transaction creates across two entities (see `IntercompanyService`) —
consolidated reports use it to eliminate intercompany revenue/expense, and the `Account.isIntercompany` flag
to eliminate intercompany balance-sheet balances. `ExchangeRateHistory` logs every change to a
`LegalEntity.currentGroupFxRate` (`EntitiesService.update()` writes one before applying the change).

## Marketplace & payments

`docs/SRS.md` §21 (`MKT-FR-*`/`PAY-FR-*`). `Vendor` and `VendorPayout` model the marketplace side;
`PaymentTransaction` models one Flutterwave charge attempt (and its eventual refund/chargeback, tracked as a
status transition on the same row, not a separate table). Two things worth knowing:

- **`OrderItem` snapshots `vendorId`/`costUgxSnapshot` at checkout, and `platformCommissionUgx`/
  `vendorPayoutUgx` at delivery** — never a live join back to `Product`/`Vendor`. A vendor's commission rate
  or a product's cost changing after the sale must not rewrite what was actually earned on that order, the
  same "snapshot, don't live-join" principle as `Payslip`/`ActivityLog` elsewhere in this schema.
- **`OrderItem.vendorPayoutId`** is what stops a vendor being paid twice for the same sale — `VendorPayout`
  computation only pulls items where it's still `null`, then claims them by setting it, rather than relying on
  non-overlapping date ranges being chosen correctly every time.
- **`Order.deliveryConfirmedAt`** (PAY-FR-5, `docs/SRS.md` §21.5) is the customer's own, separate confirmation
  that the goods arrived in good condition — set only by the customer (`PATCH /orders/:id/confirm-receipt`),
  never by staff, and deliberately not folded into `OrderStatus`: it's a signal layered on top of the
  staff-owned fulfillment pipeline (`status: DELIVERED`), not another fulfillment stage, so a customer can
  still request a refund after confirming. The printable receipt only renders in full once both are true.

## Backup and restore

**Not implemented.** There is no scheduled backup job, no restore procedure, and no tested restore drill —
see [`15-disaster-recovery.md`](./15-disaster-recovery.md) for the recommended `pg_dump`-based starting point
and why the template's Borg/borgmatic approach is oversized for ChrisPa's current single-database footprint.

## Monitoring

**Not implemented.** No connection-count, disk-usage, slow-query, or replication monitoring exists — see
[`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md).
