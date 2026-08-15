# 21. Data Flow Diagram

Gane-Sarson style DFDs for ChrisPa's real, built functionality — a Level 0 (context) diagram for the whole
system, then Level 1 diagrams for the major subsystems. Diagrams are ASCII/box-drawing art inside fenced code
blocks, not Mermaid — `md_to_docx.py` (the script that generates this document's `.docx` twin) converts fenced
blocks to literal monospace text but does not render Mermaid syntax as an actual diagram, so Mermaid would only
work in the `.md` and show as broken syntax in Word. ASCII art renders identically and correctly in both.

**Freshness note**: generated against commit `3b5fc6a` (2026-08-16), the schema/service layer as of that
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
      │  4. enter email code + phone code           │           │
      │     (2 separate calls)                      │2. create  │3. issue OTP
      v                                              v           v
 ┌──────────┐                              ╔══════════╗   ┌─────────────────┐
 │ 4.0      │                              ║   User    ║   │  2.0 Issue OTP   │
 │ Verify   ├─────────────────────────────>║  (D1)     ║   │  (OtpService)    │
 │ OTP      │  5. set emailVerifiedAt /    ╚══════════╝   └──┬────────────┬──┘
 └────┬─────┘     phoneVerifiedAt                            │            │
      │                                          6. code hash│            │6. code hash
      │ 7. once BOTH verified: issue tokens                  v            v
      v                                              ╔══════════════╗  (same store,
 ┌──────────┐                                        ║  OtpCode (D2) ║  per channel)
 │ Customer │<──────────────── tokens ────────────────╚══════════════╝
 └──────────┘

                    3a. email          3b. SMS
                  ┌──────────┐       ┌──────────┐
                  │  Brevo    │       │ Africa's  │
                  │  HTTP API │       │ Talking   │
                  └──────────┘       └──────────┘
```

- **1.0 Register**: `POST /auth/register` creates the `User` row, then dispatches both OTP channels via
  `Promise.allSettled` — a delivery failure on either channel is logged but never crashes the request (a real
  incident this session, see `13-incident-response-and-troubleshooting.md` #4).
- **2.0 Issue OTP**: generates a 6-digit code, hashes it (`OtpCode.codeHash`, same `sha256` convention as
  refresh tokens), and calls the matching delivery service.
- **3a/3b**: `MailService` calls Brevo's transactional HTTP API (not SMTP — Render's free-tier platform
  blocks outbound SMTP ports, see incident #3); `SmsService` calls Africa's Talking. Both no-op-and-log
  instead of throwing if unconfigured.
- **4.0 Verify OTP**: `POST /auth/verify-otp`, once per channel; `completeLogin()` only issues tokens once
  both `emailVerifiedAt` and `phoneVerifiedAt` (when a phone is on file) are set.
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
