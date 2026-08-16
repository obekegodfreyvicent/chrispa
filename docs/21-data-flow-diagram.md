# 21. Data Flow Diagram

Gane-Sarson style DFDs for ChrisPa's real, built functionality — a Level 0 (context) diagram for the whole
system, then Level 1 diagrams for the major subsystems. Diagrams are ASCII/box-drawing art inside fenced code
blocks, not Mermaid — `md_to_docx.py` (the script that generates this document's `.docx` twin) converts fenced
blocks to literal monospace text but does not render Mermaid syntax as an actual diagram, so Mermaid would only
work in the `.md` and show as broken syntax in Word. ASCII art renders identically and correctly in both.

**Freshness note**: generated against commit `7e197b9` (2026-08-17), the schema/service layer as of that
commit. This is a point-in-time artifact, not auto-synced to the live codebase — re-generate by hand after a
schema or major flow change, the same convention as
[`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md) and
[`23-data-dictionary.md`](./23-data-dictionary.md). See [`03-database-design.md`](./03-database-design.md) for
the narrative data-model overview these diagrams complement.

Only subsystems with real, built functionality are diagrammed here — no stubs or follow-up work drawn as if
live (see each numbered doc's "Known gaps" sections, and `docs/17-infrastructure-platform-roadmap.md`, for
what's intentionally not shown).

## Legend

```
  ┌──────────┐        ┌──────────┐       ╔══════════╗
  │ External │        │ Process  │       ║   Data   ║
  │  Entity  │        │  (verb)  │       ║   Store  ║
  └──────────┘        └──────────┘       ╚══════════╝
       │  label = data flow                    │
       └───────────────────────────────────────┘
```

## Level 0 — Context Diagram

```
                         ┌─────────────────────┐
                         │   Brevo (Email)      │
                         │   Africa's Talking    │
                         │   (SMS)               │
                         └──────────┬────────────┘
                     OTP codes out  │  ^ send request
                                    v  │
  ┌────────────┐   register/login/order/review   ┌──────────────────┐
  │  Customer   ├─────────────────────────────────>                  │
  │            │<─────────────────────────────────┤                  │
  └────────────┘   tokens/order status/receipts   │                  │
                                                    │    ChrisPa       │
  ┌────────────┐  manage products/orders/HR/       │  Platform (API   │
  │ Admin/Staff├───customers/payroll───────────────>  + Storefront +  │
  │(Owner,Mgr, │<───dashboards/reports/records──────┤   Admin console) │
  │ HR, Fulfil-│                                    │                  │
  │ ment, etc.)│                                    │                  │
  └────────────┘                                    │                  │
                                                     └────────┬─────────┘
                                                    read/write │
                                                               v
                                                     ╔═══════════════════╗
                                                     ║  PostgreSQL (all   ║
                                                     ║  persistent state) ║
                                                     ╚═══════════════════╝
```

Google Sign-In (an external identity provider ChrisPa verifies ID tokens against) and Africa's Talking's
sandbox constraint are both real integrations but omitted from the context box above to keep it legible —
see the Registration & OTP diagram below for where they sit.

## Level 1 — Customer Registration & OTP Verification

```
 ┌──────────┐   1. name/email/phone/password    ┌─────────────────┐
 │ Customer ├───────────────────────────────────>  1.0 Register    │
 └────┬─────┘                                    │  (AuthService)  │
      │                                          └──┬───────────┬──┘
      │  4. enter email code                        │           │
      v                                              │2. create  │3. issue OTP (email only)
 ┌──────────┐                              ╔══════════╗   ┌─────────────────┐
 │ 4.0      │                              ║   User    ║   │  2.0 Issue OTP   │
 │ Verify   ├─────────────────────────────>║  (D1)     ║   │  (OtpService)    │
 │ OTP      │  5. set emailVerifiedAt      ╚══════════╝   └──────────┬──────┘
 └────┬─────┘                                                        │
      │                                                  6. code hash│
      │ 7. once verified: issue tokens                               v
      v                                              ╔══════════════╗
 ┌──────────┐                                        ║  OtpCode (D2) ║
 │ Customer │<──────────────── tokens ────────────────╚══════════════╝
 └──────────┘

                    3a. email
                  ┌──────────┐
                  │  Brevo    │
                  │  HTTP API │
                  └──────────┘
```

- **1.0 Register**: `POST /auth/register` creates the `User` row, then dispatches the email OTP channel only
  — a delivery failure is logged but never crashes the request (a real incident this session, see
  `13-incident-response-and-troubleshooting.md` #4). SMS is intentionally not issued here (temporary, per user
  decision): the only Africa's Talking credentials on file are `sandbox`, which never delivers to a real phone
  number, so gating registration on it was locking customers out of accounts they could never finish
  verifying — see `07-authentication-and-authorization.md` and the SRS's FR-9.4a. Phone is still collected and
  stored (FR-9.1) for later use; only the verify-by-SMS step is skipped.
- **2.0 Issue OTP**: generates a 6-digit code, hashes it (`OtpCode.codeHash`, same `sha256` convention as
  refresh tokens), and calls `MailService`.
- **3a**: `MailService` calls Brevo's transactional HTTP API (not SMTP — Render's free-tier platform
  blocks outbound SMTP ports, see incident #3). No-ops-and-logs instead of throwing if unconfigured.
  `SmsService`/Africa's Talking still exist in the codebase and still work for other purposes, just not wired
  into this gate right now — restore the phone step once a live (non-sandbox) AT key is configured.
- **4.0 Verify OTP**: `POST /auth/verify-otp` for the email channel; `completeLogin()` issues tokens once
  `emailVerifiedAt` is set. `phoneVerifiedAt` is no longer part of this gate.
- "Sign in/up with Google" skips this entire flow — Google's own verification substitutes for it.

## Level 1 — Authentication & Login

```
 ┌──────────┐  1. identifier + password       ┌──────────────────┐
 │ Customer/├─────────────────────────────────>  1.0 Login        │
 │  Staff   │                                  │  (AuthService)   │
 └────┬─────┘                                  └──┬────────┬──────┘
      │                                           │2. read │3a. if 2FA on:
      │                                           v         │   issue challenge
      │                                    ╔══════════╗     v
      │                                    ║   User    ║  ┌──────────────┐
      │  3b. requiresTwoFactor +            ╚══════════╝  │ (challenge   │
      │      challengeToken                                │  token, JWT) │
      │<────────────────────────────────────────────────── └──────┬───────┘
      │  4. TOTP code + challengeToken                             │
      v                                                            │
 ┌──────────┐                                                      │
 │ 4.0      ├──────────────────────────────────────────────────────┘
 │ Verify   │
 │ 2FA      │
 └────┬─────┘
      │ 5. verified — call shared gate
      v
 ┌───────────────────────┐   6. check suspendedAt/deletedAt   ╔══════════╗
 │ 6.0 completeLogin()    ├────────────────────────────────────>   User    ║
 │ (single enforcement    │<────────────────────────────────── ╚══════════╝
 │  point — every login   │   blocked if either is set
 │  path funnels here)    │
 └──────────┬─────────────┘
            │ 7. record LoginEvent, ActivityLog; issue tokens
            v
      ┌──────────┐
      │ Customer/│
      │  Staff   │
      └──────────┘
```

- Password, 2FA-verified, Google, and WebAuthn logins all converge on **6.0 completeLogin()** — the single
  place `suspendedAt`/`deletedAt` are checked (added this session alongside the CRM suspend/delete feature;
  see the Admin Customer Management diagram below). `refresh()` deliberately does not call `completeLogin()`
  (token renewal, not a new login) so it carries its own copy of the same check.
- A suspended account's already-issued refresh tokens are revoked at suspend-time, not just blocked going
  forward — see 6.0's data store writes in the Admin Customer Management diagram.

## Level 1 — Admin Customer Management (suspend / reactivate / delete)

```
 ┌──────────┐  1. suspend(reason) / reactivate() / delete()   ┌─────────────────┐
 │  Admin    ├─────────────────────────────────────────────────>  1.0 CrmService  │
 │ (Owner/   │                                                 │  action          │
 │  Store    │<────────────────────── result ────────────────── └───┬─────┬───┬──┘
 │  Mgr)     │                                                       │     │   │
 └──────────┘                                          2. update     │3.   │4. write
                                                        suspendedAt/  │revoke│ActivityLog
                                                        deletedAt     │refresh│ entry
                                                            v         │tokens│    v
                                                    ╔══════════╗      v      ╔═══════════╗
                                                    ║   User    ║ ╔══════════╗║ Activity  ║
                                                    ╚══════════╝ ║RefreshToken║║ Log       ║
                                                                 ╚══════════╝╚═══════════╝
```

- **Suspend**: reversible; sets `User.suspendedAt`/`suspensionReason`, revokes every active `RefreshToken`
  for that user in the same transaction (so the hold is immediate, not "eventually" once an access token
  expires), logs `CUSTOMER_SUSPENDED`.
- **Reactivate**: clears both fields, logs `CUSTOMER_REACTIVATED`.
- **Delete**: terminal — reuses `AccountSettingsService.anonymizeUser()` (the same scrub the customer's own
  self-service delete uses), hard-deletes transient data (addresses, saved payment methods, wishlist,
  WebAuthn credentials, refresh tokens, login history, cart), anonymizes and sets `User.deletedAt`. Orders,
  reviews, support tickets, and loyalty ledger entries are deliberately left untouched. Logs
  `CUSTOMER_DELETED`.
- RBAC: `OWNER`/`STORE_MANAGER` only — `FULFILLMENT` has read-only access to `/admin/customers`, no write
  access to these three actions.

## Level 1 — Checkout & Order Processing

```
 ┌──────────┐ 1. checkout(cart, address,      ┌──────────────────┐
 │ Customer ├────delivery, coupon?)────────────>  1.0 Checkout     │
 └──────────┘                                  │  (single $tx)    │
                                                └─┬───┬───┬───┬───┘
                                    2. read cart  │   │   │   │5. clear
                                                   v   │3. │4. │  cart
                                            ╔══════╗   │decr│award
                                            ║ Cart ║   │stock loyalty
                                            ╚══════╝   v   │   v
                                             ╔═══════════╗ │ ╔══════════════╗
                                             ║  Order +   ║ │ ║ LoyaltyLedger ║
                                             ║ OrderItem  ║ │ ╚══════════════╝
                                             ╚═══════════╝ v
                                                   ╔═════════════════╗
                                                   ║ InventoryRecord  ║
                                                   ║ (FIFO per batch) ║
                                                   ╚═════════════════╝
```

```
 ┌──────────┐ 6. status transition (Pending→   ┌──────────────────┐
 │  Staff    ├──Processing→Shipped→Delivered)───>  6.0 Update       │
 │(Fulfillm.,│                                  │  Order Status     │
 │ Owner,    │<───────── updated order ────────── (state machine)   │
 │ Store Mgr)│                                  └─┬───────────────┬─┘
 └──────────┘                        7a. if CANCELLED/REFUNDED:   │7b. if DELIVERED:
                                         restock + reverse loyalty │   customer can
                                         v                          │   confirm receipt
                                  ╔═════════════════╗              v
                                  ║ InventoryRecord/ ║      ┌──────────────┐
                                  ║ LoyaltyLedger    ║      │ Customer     │
                                  ╚═════════════════╝      │ confirms     │
                                                            │ receipt      │
                                                            └──────────────┘
```

- Only `CASH_ON_DELIVERY` completes end-to-end; `MOBILE_MONEY`/`CARD` return `501` (no gateway wired — see
  `PaymentTransaction` in the data dictionary for the schema that's ready once one is).
- `deliveryConfirmedAt` is a separate, customer-only signal from staff-set `status: DELIVERED` — the
  "mutual consent" the printable receipt requires.
- **Shipping fee (added this session, per user decision)**: before step 1.0's `$transaction` opens,
  `1.0 Checkout` calls `ShippingZonesService.priceFor(city, deliveryMethod)`, which matches the shipping
  address's city against an admin-managed `ShippingZone` (falling back to whichever zone is `isDefault`) and
  returns that zone's fee for the chosen delivery method — throwing a `400` first if the matched zone doesn't
  offer that method at all, before any cart/stock work happens. The zone's name is snapshotted onto
  `Order.shippingZoneName` alongside the numeric fee. Replaces the old flat per-delivery-method fee table
  that ignored the destination entirely — see [`16-user-and-administrator-procedures.md`](./16-user-and-administrator-procedures.md)
  for how an admin edits zones/rates at Admin → Shipping Zones.

## Level 1 — Driver App: Assignment & Delivery Tracking

Added after this document's original freshness date (commit `75b7cff`, per user request, not in the original
SRS) — see [`00-documentation-index.md`](./00-documentation-index.md)'s cross-cutting note on why this
section postdates the rest of the document.

```
 ┌──────────┐  1. assign(driverId)             ┌───────────────────┐
 │  Admin    ├─────────────────────────────────>│ 1.0 Delivery       │
 │ (Owner /  │                                  │ Service.assign()   │
 │ StoreMgr/ │<──────── delivery + driver ────── └──┬──────────┬─────┘
 │ Fulfillm.)│                                      │2. upsert │3. write
 └──────────┘                                       v          v
                                              ╔═══════════╗ ╔═══════════╗
                                              ║ Delivery  ║ ║ActivityLog║
                                              ╚═══════════╝ ╚═══════════╝
```

```
 ┌──────────┐ 4. status(EN_ROUTE_TO_PICKUP,    ┌───────────────────┐
 │  Driver   ├──PICKED_UP+gps, EN_ROUTE_TO──────>│ 4.0 Delivery       │
 │ (own      │  CUSTOMER, DELIVERED+gps)         │ Service             │
 │ deliveries│<────────── updated delivery ────── │ .updateStatus()    │
 │ only)     │                                    └──┬─────────┬──────┘
 └──────────┘                          5. write       │         │6. mirror onto
                                        Delivery       │         │  Order.status
                                        (GPS+timestamp │         │  (reuses 6.0
                                        at pickup/      v         │  Update Order
                                        delivery)  ╔═══════════╗  │  Status, see
                                                    ║ Delivery  ║  │  Checkout &
                                                    ╚═══════════╝  │  Order
                                                                    │  Processing
                                                                    v  above)
                                                            ╔═══════════╗
                                                            ║   Order   ║
                                                            ╚═══════════╝
```

- **Assignment** (`PATCH /admin/orders/:id/assign-driver`, `OWNER`/`STORE_MANAGER`/`FULFILLMENT` — same RBAC
  boundary as order management, not a separate permission): upserts a `Delivery` row 1:1 with the `Order`.
  Reassigning an in-progress delivery resets its own lifecycle back to `ASSIGNED` (pickup/delivery snapshots
  cleared) but never moves `Order.status` backward.
- **Driver status updates** (`PATCH /driver/deliveries/:id/status`, `DRIVER` only, ownership-checked to the
  caller's own assigned deliveries): `ASSIGNED → EN_ROUTE_TO_PICKUP → PICKED_UP → EN_ROUTE_TO_CUSTOMER →
  DELIVERED`, or `FAILED` from any in-progress state. `PICKED_UP`/`DELIVERED` require GPS coordinates
  (captured via the browser's `navigator.geolocation`, per user decision — deep-link to Google Maps for
  actual turn-by-turn directions rather than an in-app map/routing SDK) and snapshot them plus a timestamp.
- **Mirrored onto `Order.status`**: `PICKED_UP` → `SHIPPED`, `DELIVERED` → `DELIVERED`, by calling
  `OrdersService.updateStatus()` directly (step 6.0 above is the same process box as the Checkout & Order
  Processing diagram's staff-triggered transition) — stepping through `PROCESSING` first if the order hadn't
  already been moved there, so a driver being assigned before staff has processed the order is a normal
  sequencing, not an error. This is why a `DELIVERED` delivery also triggers revenue recognition exactly as
  a staff-triggered `DELIVERED` transition would — it's literally the same code path.
- A separate, lower-frequency flow (not diagrammed): `PATCH /driver/deliveries/:id/location` writes a single
  last-known-position snapshot (`currentLat`/`currentLng`/`lastLocationAt`, overwritten each call) — a manual
  "share my current location" action, not continuous background tracking.
- Both the customer's and staff's printable receipt (see Checkout & Order Processing above) read `Delivery`
  via `Order.delivery` to show driver name, pickup time+location, and delivery time+location.

**Added commit `445a258`** (delivery-services MVP gaps, scoped against the customer's own stated MVP list —
see [`16-user-and-administrator-procedures.md`](./16-user-and-administrator-procedures.md) for what was
deliberately left out and why):
- **Driver availability** (`PATCH`/`GET /driver/status`): a plain `User.driverStatus` write, self-reported
  only — not wired into the assignment or status-update flows above, deliberately (see the schema comment on
  why it's never derived from a driver's own `Delivery` rows).
- **Priority** (`assign-driver`'s optional `priority` field): stored on `Delivery`, read back only by
  `listMine()`'s sort order (`priority desc, assignedAt asc`) — no other process consumes it; there is no
  automated-dispatch flow that reads it.
- **Customer notifications**: `notifyCustomer()` runs after each of the flows above that changes `status` to
  `ASSIGNED`, `PICKED_UP`, `DELIVERED`, or `FAILED` — reads `Order.user`'s `notifyOrderUpdatesEmail`/
  `notifyOrderUpdatesSms` preferences, then calls `MailService`/`SmsService` (the same already-live Brevo/
  Africa's Talking integrations registration OTP uses). Best-effort — wrapped so a send failure is logged and
  swallowed, never blocking the delivery-status write it's attached to.
- **Admin Dashboard summary** (`GET /admin/deliveries/summary`, not diagrammed — a simple `groupBy` read, no
  new data flow of its own): feeds the Dashboard's new "Active Deliveries" panel.

## Level 1 — Inventory (read side)

```
 ┌──────────┐  1. list inventory (filters:      ┌──────────────────┐
 │  Staff    ├────warehouse, low-stock)──────────>  1.0 Query        │
 └──────────┘                                    │  InventoryRecord  │
      ^                                          └────────┬─────────┘
      │ 2. records + reorderPoint flags                   v
      └──────────────────────────────────────── ╔═════════════════╗
                                                  ║ InventoryRecord  ║
                                                  ║ (per product ×   ║
                                                  ║  warehouse ×     ║
                                                  ║  batch)          ║
                                                  ╚═════════════════╝
```

`Product.stockQty`/`Variant.stockQty` are denormalized read caches for storefront "in stock?" badges only —
`InventoryRecord` is the source of truth, decremented during checkout (see above); nothing currently keeps the
denormalized caches in sync automatically (a documented gap, not an oversight — see `schema.prisma`'s comment
on `Product.stockQty`).

## Level 1 — Payroll (HR)

```
 ┌──────────┐ 1. run(periodId)                 ┌──────────────────┐
 │ HR/Owner ├───────────────────────────────────>  1.0 PayrollService│
 └──────────┘                                   │  .run() ($tx)     │
      ^                                         └─┬────┬────┬──────┘
      │ 6. computed payslips                      │    │    │
      └─────────────────────────────────────      │2. read│3. read│4. compute
                                                    v    │allowances│PAYE/NSSF
                                          ╔══════════════╗│         │(pure util)
                                          ║  Employee     ║v         v
                                          ╚══════════════╝╔══════════════╗ ╔══════════╗
                                                           ║EmployeeAllow-║ ║ Payslip   ║
                                                           ║ance, Salary  ║ ║ (delete + ║
                                                           ║Advance,      ║ ║ recreate  ║
                                                           ║PayrollAdjust-║ ║ per run)  ║
                                                           ║ment          ║ ╚══════════╝
                                                           ╚══════════════╝
```

```
 ┌──────────┐  7. finalize(periodId)           ┌──────────────────┐
 │ HR/Owner ├───────────────────────────────────>  7.0 Finalize     │
 └──────────┘                                   │  (locks period,   │
                                                 │  decrements       │
                                                 │  advance balances)│
                                                 └────────┬──────────┘
                                                           v
                                                 ╔══════════════════╗
                                                 ║ PayrollPeriod:     ║
                                                 ║ status=FINALIZED   ║
                                                 ║ SalaryAdvance:      ║
                                                 ║ balanceRemainingUgx ║
                                                 ╚══════════════════╝
```

`run()` deletes-and-recreates that period's payslips inside a transaction, so re-running before finalization
is safe (idempotent); only `finalize()` actually mutates `SalaryAdvance.balanceRemainingUgx`, which is what
keeps a re-run from double-deducting. PAYE/NSSF computation (`paye-nssf.util.ts`) is a pure function, not a
data-flow node with its own store — shown above as a compute step inside 1.0 for that reason.
