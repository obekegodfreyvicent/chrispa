# 22. Entity Relationship Diagram

**Freshness note**: generated against commit `3b5fc6a` (2026-08-16), `apps/api/prisma/schema.prisma` as of
that commit — a point-in-time artifact, not auto-synced; re-generate by hand after schema changes. See
[`03-database-design.md`](./03-database-design.md) for the narrative overview, and
[`23-data-dictionary.md`](./23-data-dictionary.md) for full field-level detail.

This schema has ~60 models — one diagram of all of them would be unreadable. Instead: **one complete
relationship table** below (every foreign key, one row each), then **small ASCII diagrams per domain
cluster** (same groupings as `03-database-design.md`'s schema-inventory table), each just legible enough to
actually read.

## Conventions

- Every model's primary key is a client-generated UUID (`@id @default(uuid())`) — no auto-increment integer
  IDs anywhere in this schema, per `CLAUDE.md`.
- Cardinality: `1:1` where the FK field also carries `@unique`, `1:N` otherwise. No `N:N` relations exist as
  true join tables with their own extra columns except `ProductWellnessTag` (a plain many-to-many join);
  `Bundle.productIds` is a scalar `String[]` array of Product IDs instead of a join table — no referential
  integrity there, a deliberate simplification for a small, admin-curated feature (see `schema.prisma`'s
  comment on `Bundle`).
- `onDelete` — where the schema doesn't specify one, Prisma/Postgres falls back to `NO ACTION`/`RESTRICT`-like
  default behavior (the delete is blocked if referencing rows exist), listed below as "not set" rather than
  guessed at a specific keyword.

## Full foreign-key relationship table

| Parent | Child | FK field | Cardinality | onDelete | Note |
|---|---|---|---|---|---|
| User | RefreshToken | userId | 1:N | Cascade | |
| User | WebAuthnCredential | userId | 1:N | Cascade | |
| User | LoginEvent | userId | 1:N | Cascade | |
| User | Notification | userId | 1:N | Cascade | |
| User | OtpCode | userId | 1:N | Cascade | |
| User | Address | userId | 1:N | Cascade | |
| User | PaymentMethod | userId | 1:N | Cascade | |
| User | Cart | userId | 1:1 | Cascade | `userId` optional+unique — a guest cart has `userId: null`, `sessionId` instead |
| User | LoyaltyAccount | userId | 1:1 | Cascade | |
| User | Review | userId | 1:N | Cascade | |
| User | SupportTicket | userId | 1:N | Cascade | |
| User | TicketMessage | authorUserId | 1:N | Cascade | either customer or staff can author a message |
| User | WishlistItem | userId | 1:N | Cascade | |
| User | Order | userId | 1:N | not set | optional — `Order.userId` nullable, order can outlive/precede a full account record |
| User | Employee | userId | 1:1 | not set | **optional both ways** — Employee exists independently of User (pre-onboarding); a User is never required to have an Employee row |
| User | LeaveRequest | reviewedByUserId | 1:N | not set | optional, staff reviewer |
| User | ShiftSwapRequest | reviewedByUserId | 1:N | not set | optional, staff reviewer |
| User | PerformanceGoal | createdByUserId | 1:N | not set | |
| User | PerformanceFeedback | givenByUserId | 1:N | not set | |
| User | PerformanceReview | reviewerUserId | 1:N | not set | |
| User | JobPosting | createdByUserId | 1:N | not set | optional |
| User | PayrollPeriod | createdByUserId | 1:N | not set | |
| User | SalaryAdvance | approvedByUserId | 1:N | not set | |
| User | PayrollAdjustment | createdByUserId | 1:N | not set | |
| User | ActivityLog | actorUserId | — | — | **not a real `@relation`** — plain string, snapshotted at write time. An audit trail must survive independently of the row it describes (same reasoning as anonymize-on-delete elsewhere); a write can never fail on a missing/anonymized actor |
| User | ExchangeRateHistory | changedByUserId | — | — | **also a plain string, not a `@relation`** — same non-FK pattern as `ActivityLog.actorUserId`, undocumented in the schema's own comments but consistent with the audit-trail convention |
| ProductLine | Product | productLineId | 1:N | not set | |
| Vendor | Product | vendorId | 1:N | not set | optional — null = ChrisPa's own product |
| Product | ProductWellnessTag | productId | 1:N | Cascade | join table, composite PK `(productId, wellnessTagId)` |
| WellnessTag | ProductWellnessTag | wellnessTagId | 1:N | Cascade | |
| Product | ProductMedia | productId | 1:N | Cascade | |
| Product | Variant | productId | 1:N | Cascade | |
| Product | InventoryRecord | productId | 1:N | Cascade | |
| Warehouse | InventoryRecord | warehouseId | 1:N | Cascade | |
| Product | Review | productId | 1:N | Cascade | |
| Product | CartItem | productId | 1:N | not set | |
| Variant | CartItem | variantId | 1:N | not set | optional |
| Product | OrderItem | productId | 1:N | not set | |
| Variant | OrderItem | variantId | 1:N | not set | optional |
| Vendor | OrderItem | vendorId | 1:N | not set | optional, snapshotted at order time |
| VendorPayout | OrderItem | vendorPayoutId | 1:N | not set | optional — null until included in a payout run |
| Product | WishlistItem | productId | 1:N | Cascade | |
| Cart | CartItem | cartId | 1:N | Cascade | |
| Warehouse | Order | warehouseId | 1:N | not set | optional |
| Order | OrderItem | orderId | 1:N | Cascade | |
| Order | LoyaltyLedgerEntry | orderId | 1:N | not set | optional |
| Order | SupportTicket | orderId | 1:N | not set | optional |
| Order | PaymentTransaction | orderId | 1:N | not set | optional — a Flutterwave charge can be initiated before the order is confirmed to exist |
| LoyaltyAccount | LoyaltyLedgerEntry | loyaltyAccountId | 1:N | Cascade | |
| SupportTicket | TicketMessage | ticketId | 1:N | Cascade | |
| Vendor | VendorPayout | vendorId | 1:N | not set | |
| Department | DepartmentPermission | departmentId | 1:N | Cascade | |
| Department | Employee | departmentId | 1:N | not set | optional |
| Department | JobPosting | departmentId | 1:N | not set | optional |
| Employee | Employee | managerId | 1:N | not set | self-relation (`EmployeeManager`), optional — one manager, many direct reports |
| Employee | EmploymentHistoryEntry | employeeId | 1:N | Cascade | |
| Employee | EmployeeDocument | employeeId | 1:N | Cascade | |
| Employee | TimeEntry | employeeId | 1:N | Cascade | |
| Employee | LeaveRequest | employeeId | 1:N | Cascade | |
| Employee | Shift | employeeId | 1:N | Cascade | |
| Shift | ShiftSwapRequest | shiftId | 1:N | Cascade | |
| Employee | ShiftSwapRequest | requestedByEmployeeId | 1:N | not set | |
| Employee | ShiftSwapRequest | coverEmployeeId | 1:N | not set | swap approval reassigns the parent `Shift.employeeId` to this employee |
| Employee | PerformanceGoal | employeeId | 1:N | Cascade | |
| Employee | PerformanceFeedback | employeeId | 1:N | Cascade | |
| Employee | PerformanceReview | employeeId | 1:N | Cascade | |
| JobPosting | Applicant | jobPostingId | 1:N | Cascade | |
| Employee | Applicant | convertedEmployeeId | 1:1 | not set | optional+unique — set once `RecruitmentService.convertToEmployee()` runs |
| PayrollPeriod | Payslip | periodId | 1:N | Cascade | |
| Employee | Payslip | employeeId | 1:N | not set | |
| Employee | EmployeeAllowance | employeeId | 1:N | Cascade | |
| Employee | SalaryAdvance | employeeId | 1:N | not set | |
| Payslip | PayslipAdvanceRepayment | payslipId | 1:N | Cascade | |
| SalaryAdvance | PayslipAdvanceRepayment | advanceId | 1:N | not set | |
| PayrollPeriod | PayrollAdjustment | periodId | 1:N | Cascade | |
| Employee | PayrollAdjustment | employeeId | 1:N | not set | |
| LegalEntity | LegalEntity | parentEntityId | 1:N | not set | self-relation (`EntityHierarchy`), optional — null = the group's ultimate parent |
| LegalEntity | Account | entityId | 1:N | not set | |
| LegalEntity | Account | counterpartyEntityId | 1:N | not set | optional — marks the intercompany due-to/due-from account's counterparty entity |
| Account | Account | parentAccountId | 1:N | not set | self-relation (`AccountHierarchy`), optional |
| LegalEntity | FiscalPeriod | entityId | 1:N | not set | |
| LegalEntity | JournalEntry | entityId | 1:N | not set | |
| FiscalPeriod | JournalEntry | fiscalPeriodId | 1:N | not set | journal entries can only post into an `OPEN` period |
| JournalEntry | JournalEntryLine | journalEntryId | 1:N | Cascade | |
| Account | JournalEntryLine | accountId | 1:N | not set | |

## Non-obvious rules worth knowing before touching any of the above

- **`ActivityLog.actorUserId` and `ExchangeRateHistory.changedByUserId` are not real foreign keys** — both
  are plain `String`/`String?` columns, deliberately not `@relation`s, so an audit-trail write can never fail
  or block on a missing/since-anonymized user row.
- **`User` ↔ `Employee` is optional on both sides** — `Employee` is intentionally independent of `User` (HR
  can hold a record for someone in recruitment/onboarding, or an employee who never gets a system login); a
  `User` is never required to link to an `Employee` either (most customer/staff accounts have none).
- **`User.suspendedAt`/`deletedAt`** are not relations but govern one: `AuthService.completeLogin()` (and
  `refresh()` separately) block token issuance while either is set — see `21-data-flow-diagram.md`'s
  Authentication & Login diagram. `deletedAt` also nulls out `email`/`phone` so those `@unique` columns free
  up for a future re-registration (Postgres treats each `NULL` as distinct).
- **`Product` is soft-archived, never hard-deleted**, once it has real order history — `OrderItem.productId`
  has no `onDelete: Cascade`/`SetNull`, so a hard delete would violate that FK by design; that's what forces
  the archive-instead-of-delete convention (`ProductStatus.ARCHIVED`) in `CatalogService`.
- **`Employee` is soft-terminated, never hard-deleted** — same reasoning, `employmentStatus: TERMINATED`
  plus an `EmploymentHistoryEntry` audit row, never a real `DELETE`.
- **`Bundle.productIds`** is a scalar `String[]` of Product IDs, not a join table — no referential integrity
  (a deleted/archived product ID can linger in a bundle's array unnoticed); a deliberate simplification, not
  an oversight, per the schema's own comment.
- **Notable `@@unique` constraints** beyond simple PK/FK uniqueness: `InventoryRecord`
  `[productId, warehouseId, batchLot]`; `CartItem` `[cartId, productId, variantId]` (Postgres's NULL-is-distinct
  behavior means this doesn't dedupe null-variant rows — handled in application code, see
  `cart.service.ts`); `WishlistItem` `[userId, productId]`; `Account` `[entityId, code]`; `FiscalPeriod`
  `[entityId, month]`; `JournalEntry` `[entityId, entryNumber]`; `Payslip` `[periodId, employeeId]`;
  `DepartmentPermission` `[departmentId, resource]`; `PayrollPeriod` `[month, type]` — the field that lets a
  `REGULAR` and a `THIRTEENTH_MONTH` period coexist in the same December.

## Domain cluster diagrams

### Identity & auth

```
   ┌──────────┐ 1:N  ┌──────────────┐     ┌──────────┐ 1:N  ┌────────────┐
   │   User    ├──────>RefreshToken │     │   User    ├──────>WebAuthn    │
   │          │      └──────────────┘     │          │      │Credential  │
   │          │ 1:N  ┌──────────────┐     │          │      └────────────┘
   │          ├──────>  LoginEvent  │     │          │ 1:N  ┌────────────┐
   │          │      └──────────────┘     │          ├──────>  OtpCode   │
   │          │ 1:N  ┌──────────────┐     └──────────┘      └────────────┘
   │          ├──────>Notification  │
   └──────────┘      └──────────────┘
```

### Customer account

```
   ┌──────────┐ 1:N  ┌──────────────┐        ┌──────────┐ 1:N  ┌──────────────┐
   │   User    ├──────>   Address    │        │   User    ├──────>PaymentMethod │
   └──────────┘      └──────────────┘        └──────────┘      └──────────────┘
```

### Catalog

```
   ┌────────────┐ 1:N  ┌──────────┐ 1:N  ┌──────────────┐
   │ ProductLine├──────>  Product  ├──────>ProductWellness│
   └────────────┘      └────┬─────┘      │Tag (join)      │<──1:N──┌────────────┐
                             │            └──────────────┘         │ WellnessTag │
                    1:N ┌────┴────┐ 1:N                            └────────────┘
                        v          v
                 ┌────────────┐ ┌─────────┐
                 │ ProductMedia│ │ Variant │
                 └────────────┘ └─────────┘
                        ^
                 optional N:1
                 ┌──────────┐
                 │  Vendor   │
                 └──────────┘
```

### Inventory & cart/checkout

```
   ┌──────────┐ 1:N  ┌─────────────────┐      ┌──────────┐ 1:1  ┌──────┐ 1:N ┌──────────┐
   │  Product  ├──────>InventoryRecord │      │   User    ├──────> Cart ├─────>CartItem  │
   └──────────┘      │<──1:N── Warehouse│      └──────────┘      └──────┘     └──────────┘
                      └─────────────────┘

   ┌──────────┐ 1:N  ┌──────────┐ 1:N  ┌──────────┐
   │   User    ├──────>  Order   ├──────>OrderItem │──N:1──> Product, Variant (optional),
   │(optional) │      │<─N:1─    │      └──────────┘         Vendor (optional),
   └──────────┘      │Warehouse │                            VendorPayout (optional)
                      └────┬─────┘
                 1:N ┌─────┴─────┐ 1:N
                     v            v
              ┌────────────┐ ┌──────────────┐
              │SupportTicket│ │LoyaltyLedger │
              └────────────┘ │Entry          │
                              └──────────────┘
```

### Marketplace & payments

```
   ┌──────────┐ 1:N  ┌──────────┐            ┌──────────┐ 1:N  ┌───────────────────┐
   │  Vendor   ├──────>  Product  │           │  Order    ├──────>PaymentTransaction│
   │          │ 1:N  ┌──────────┐            │(optional)│      └───────────────────┘
   │          ├──────>OrderItem  │            └──────────┘
   │          │ 1:N  ┌──────────┐
   │          ├──────>VendorPayout│──1:N──> OrderItem (paid line items)
   └──────────┘      └──────────┘
```

### Loyalty & CRM/support

```
   ┌──────────┐ 1:1  ┌──────────────┐ 1:N  ┌────────────────────┐
   │   User    ├──────>LoyaltyAccount├──────>LoyaltyLedgerEntry  │──N:1(optional)──> Order
   └──────────┘      └──────────────┘      └────────────────────┘

   ┌──────────┐ 1:N  ┌──────────────┐ 1:N  ┌──────────────┐
   │   User    ├──────>SupportTicket ├──────>TicketMessage │──N:1──> User (author)
   └──────────┘      └──────────────┘      └──────────────┘

   ┌──────────┐ 1:N  ┌──────────┐          ┌──────────┐ 1:N  ┌──────────────┐
   │   User    ├──────>  Review  │<──N:1────┤  Product  │      │              │
   └──────────┘      └──────────┘          └──────────┘      │              │
   ┌──────────┐ 1:N  ┌──────────────┐ N:1                            
   │   User    ├──────>WishlistItem ├──────> Product (unique per user+product)
   └──────────┘      └──────────────┘
```

### HR — org, attendance/leave/shifts

```
   ┌────────────┐ 1:N  ┌──────────┐ 1:N  ┌────────────────┐
   │ Department  ├──────>Employee  ├──────>EmploymentHistory│
   │            │      │  (self:   │      │Entry            │
   │            │ 1:N  │  manager/ │ 1:N  └────────────────┘
   │            ├──────>direct     ├──────>EmployeeDocument │
   └────────────┘      │  reports) │      └────────────────┘
                        └────┬─────┘
              1:N ┌──────────┼──────────┐ 1:N
                  v          v          v
           ┌──────────┐┌──────────┐┌──────────┐
           │TimeEntry  ││LeaveRequest││  Shift   │──1:N──> ShiftSwapRequest
           └──────────┘└──────────┘└──────────┘         (requestedBy/coverEmployee)
```

### HR — performance & recruitment

```
   ┌──────────┐ 1:N  ┌────────────────┐         ┌────────────┐ 1:N  ┌──────────┐
   │ Employee  ├──────>PerformanceGoal │         │ JobPosting  ├──────>Applicant │
   │          │ 1:N  ┌────────────────┐         └────────────┘      │(optional  │
   │          ├──────>PerformanceFeed- │                            │ 1:1 to    │
   │          │      │back              │                           │ Employee  │
   │          │ 1:N  └────────────────┘                            │ once      │
   │          ├──────>PerformanceReview │                           │ converted)│
   └──────────┘      └────────────────┘                            └──────────┘
```

### HR — payroll

```
   ┌──────────────┐ 1:N  ┌──────────┐ 1:N  ┌────────────────────┐
   │ PayrollPeriod ├──────>  Payslip  ├──────>PayslipAdvance      │──N:1──> SalaryAdvance
   │              │      │          │      │Repayment            │
   │              │ 1:N  └──────────┘      └────────────────────┘
   │              ├──────>PayrollAdjust-│
   └──────────────┘      │ment           │──N:1──> Employee
                          └────────────────┘
   ┌──────────┐ 1:N  ┌──────────────────┐      ┌──────────┐ 1:N  ┌──────────────┐
   │ Employee  ├──────>EmployeeAllowance │      │ Employee  ├──────>SalaryAdvance │
   └──────────┘      └──────────────────┘      └──────────┘      └──────────────┘
```

### Financial & accounting (multi-entity)

```
   ┌────────────┐ 1:N  ┌──────────┐ 1:N  ┌──────────────┐ 1:N  ┌────────────────┐
   │ LegalEntity ├──────>  Account  │      │ JournalEntry  ├──────>JournalEntryLine│──N:1──> Account
   │  (self:     │ 1:N  │  (self:   │      │              │      └────────────────┘
   │  parent/    ├──────>  parent/  │      └──────┬───────┘
   │  subsidiary)│      │  child)   │             │N:1
   │            │ 1:N  └──────────┘             v
   │            ├──────>FiscalPeriod │───1:N──>JournalEntry (must post into an OPEN period)
   └────────────┘      └──────────┘
```

`GroupSettings` is a singleton with no relations (always read as "the first row"). `ExchangeRateHistory`
references `LegalEntity`/`User` by plain string columns only (see the callout above), so it's intentionally
omitted from this diagram's connecting lines despite being part of the same domain.
