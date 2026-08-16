# 23. Data Dictionary

Full field-by-field reference for every model and enum in `apps/api/prisma/schema.prisma`, grouped by the
same domain sections as [`03-database-design.md`](./03-database-design.md)'s schema-inventory table. See also
[`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md) for how these models relate to
each other.

**Freshness note**: generated against commit `3b5fc6a` (2026-08-16) — a point-in-time artifact, not
auto-synced to the live schema; treat any discrepancy with the current `schema.prisma` as this document
having drifted, not the code being wrong.

**Conventions used throughout** (see `schema.prisma`'s own header comment and `CLAUDE.md`): every primary key
is a client-generated UUID (`id String @id @default(uuid())`, omitted from "Notes" below unless it deviates);
every `DateTime` is stored `@db.Timestamptz(3)` (UTC, never a timezone-naive `timestamp`); non-unique
`@@index` blocks exist on every foreign key not already covered by a `@unique`/`@@unique` (Postgres doesn't
add these automatically, unlike some other connectors) — index annotations are not repeated per-field below
unless they're compound/notable.

---

## Identity & auth

### User

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| email | String | Yes | — | `@unique`; nulled on delete (see `deletedAt`) |
| phone | String | Yes | — | `@unique`; nulled on delete |
| name | String | No | — | |
| preferredName | String | Yes | — | |
| avatarUrl | String | Yes | — | Pasted image URL — no upload/object-storage pipeline |
| passwordHash | String | Yes | — | Null for a Google-only account, or once deleted |
| role | UserRole | No | CUSTOMER | |
| tier | CustomerTier | No | STANDARD | |
| dateOfBirth | DateTime | Yes | — | |
| gender | String | Yes | — | |
| wellnessPreferences | String[] | No | `[]` | |
| twoFactorEnabled | Boolean | No | false | TOTP 2FA, enforced at login |
| twoFactorSecret | String | Yes | — | Encrypted at rest (AES-256-GCM) — verifying TOTP needs it back, so it can't be one-way hashed |
| biometricEnabled | Boolean | No | false | True once ≥1 WebAuthnCredential exists |
| notifyOrderUpdatesSms | Boolean | No | true | |
| notifyOrderUpdatesEmail | Boolean | No | true | |
| notifyPromotions | Boolean | No | false | |
| notifyPush | Boolean | No | true | |
| notifyLoginAlerts | Boolean | No | false | Delivered in-app only, no SMS/email provider |
| mustChangePassword | Boolean | No | false | Set on staff temp-password issuance; enforced globally by `MustChangePasswordGuard` |
| emailVerifiedAt | DateTime | Yes | — | Set once registration OTP (email) is confirmed |
| phoneVerifiedAt | DateTime | Yes | — | Set once registration OTP (SMS) is confirmed — SMS verification is temporarily excluded from the registration/login gate (sandbox-only Africa's Talking credentials), so this stays unset for most accounts today |
| googleId | String | Yes | — | `@unique`; set on first Google sign-in |
| suspendedAt | DateTime | Yes | — | Admin-triggered, reversible hold — see `CrmService.suspend()`. Blocks login at `completeLogin()` |
| suspensionReason | String | Yes | — | Free text, shown in the admin audit log |
| deletedAt | DateTime | Yes | — | Terminal — FR-17.4. Row survives, PII scrubbed |
| driverStatus | DriverStatus | No | OFFLINE | Added commit `445a258` — only meaningful for `role: DRIVER`; self-reported via `PATCH /driver/status`, never derived from the driver's own `Delivery` rows |
| createdAt | DateTime | No | now() | |
| updatedAt | DateTime | No | auto | `@updatedAt` |

### RefreshToken

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| tokenHash | String | No | — | `sha256`, not bcrypt — bcrypt truncates at 72 bytes and these JWTs share a long common prefix per-user, which silently defeated rotation/revocation before this was caught |
| expiresAt | DateTime | No | — | |
| revokedAt | DateTime | Yes | — | Set on logout, refresh (rotation), or admin suspend/delete |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@index([userId, revokedAt])` matches `refresh()`'s lookup |

### WebAuthnCredential

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| credentialId | String | No | — | `@unique` |
| publicKey | Bytes | No | — | Never anything biometric itself — that never leaves the device |
| counter | BigInt | No | 0 | Anti-replay counter |
| deviceLabel | String | Yes | — | |
| createdAt | DateTime | No | now() | |
| lastUsedAt | DateTime | Yes | — | |

### LoginEvent

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| ipAddress | String | Yes | — | |
| userAgent | String | Yes | — | |
| isNewDevice | Boolean | No | false | Lightweight (ip, userAgent) fingerprint match, not rigorous device identity |
| acknowledgedAt | DateTime | Yes | — | Dismissal of the in-app alert banner |
| createdAt | DateTime | No | now() | One row per completed login (not token refresh) |

### OtpCode

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| channel | OtpChannel | No | — | EMAIL or SMS |
| purpose | OtpPurpose | No | REGISTRATION | Only value in use today |
| destination | String | No | — | Snapshot of the email/phone at issue time, not a live join to User |
| codeHash | String | No | — | `sha256`, same convention as `RefreshToken.tokenHash` |
| attempts | Int | No | 0 | Locks out at 5 |
| consumedAt | DateTime | Yes | — | |
| expiresAt | DateTime | No | — | `OTP_TTL_MINUTES`, default 10 |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@index([userId, channel, purpose])` |

### Notification

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| type | NotificationType | No | — | Only `NEWSLETTER` in use — deliberately generic for future reuse |
| title | String | No | — | |
| body | String | No | — | |
| linkUrl | String | Yes | — | |
| readAt | DateTime | Yes | — | |
| createdAt | DateTime | No | now() | |

---

## Customer account

### Address

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| label | String | No | — | |
| recipient | String | No | — | |
| line1 | String | No | — | |
| city | String | No | "Kampala" | |
| phone | String | No | — | |
| type | AddressType | No | SHIPPING | `isDefault` is scoped per type — one default shipping, one default billing |
| isDefault | Boolean | No | false | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### PaymentMethod

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| type | PaymentMethodType | No | — | Only `MOBILE_MONEY` fully supported; `CARD` rejected with 501 |
| maskedIdentifier | String | No | — | |
| gatewayToken | String | No | — | Never a raw card number — no PCI-DSS gateway |
| isDefault | Boolean | No | false | Single flag across all of a user's methods (unlike `Address.isDefault`) |
| createdAt / updatedAt | DateTime | No | now() / auto | |

---

## Catalog

### ProductLine

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name | String | No | — | `@unique` |
| slug | String | No | — | `@unique` |
| unitSize | String | No | — | |

### WellnessTag

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| label | String | No | — | `@unique` |

### Product

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| sku | String | No | — | `@unique` |
| name | String | No | — | |
| slug | String | No | — | `@unique` |
| productLineId | String | No | — | FK → ProductLine |
| priceUgx | Int | No | — | |
| vendorId | String | Yes | — | FK → Vendor; null = ChrisPa's own product |
| costUgx | Int | Yes | — | COGS basis; null skips COGS posting rather than assuming zero cost |
| stockQty | Int | No | 0 | **Denormalized read cache** — `InventoryRecord` is the source of truth; nothing keeps this in sync automatically yet |
| status | ProductStatus | No | DRAFT | Archive, never hard-delete, once real order history exists |
| scentOrFlavorNotes | String | Yes | — | |
| directions | String | Yes | — | |
| healthBenefits | String | Yes | — | |
| seoTitle | String | Yes | — | |
| seoMeta | String | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@index([productLineId])`, `@@index([status, productLineId])`, `@@index([vendorId])` |

### ProductWellnessTag

Join table. Composite PK `(productId, wellnessTagId)`, both Cascade.

### ProductMedia

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| productId | String | No | — | FK → Product, Cascade |
| url | String | No | — | Real upload (`POST /admin/products/media/upload`), local disk, no CDN |
| sortOrder | Int | No | 0 | |
| createdAt | DateTime | No | now() | |

### Variant

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| productId | String | No | — | FK → Product, Cascade |
| size | String | No | — | |
| priceDelta | Int | No | 0 | Added to `Product.priceUgx` |
| stockQty | Int | No | 0 | Same denormalized-cache caveat as `Product.stockQty` |

---

## Inventory

### Warehouse

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name | String | No | — | `@unique` |
| location | String | No | — | |
| createdAt | DateTime | No | now() | |

### InventoryRecord

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| productId | String | No | — | FK → Product, Cascade |
| warehouseId | String | No | — | FK → Warehouse, Cascade |
| batchLot | String | Yes | — | Checkout decrements FIFO across batches |
| qtyOnHand | Int | No | 0 | Source of truth for stock, per product × warehouse × batch |
| reorderPoint | Int | No | 0 | Drives low-stock admin flags |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@unique([productId, warehouseId, batchLot])`; `@@index([warehouseId])` |

---

## Cart & checkout

### Cart

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | Yes | — | `@unique`, FK → User, Cascade; null for a guest cart |
| sessionId | String | Yes | — | `@unique`; guest-cart identifier |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### CartItem

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| cartId | String | No | — | FK → Cart, Cascade |
| productId | String | No | — | FK → Product |
| variantId | String | Yes | — | FK → Variant |
| qty | Int | No | 1 | |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@unique([cartId, productId, variantId])` — NULL-is-distinct means this doesn't dedupe null-variant rows; handled explicitly in `CartService.addItem()` |

### Order

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| orderNumber | String | No | — | `@unique` |
| userId | String | Yes | — | FK → User |
| status | OrderStatus | No | PENDING | State machine — see `ALLOWED_TRANSITIONS` in `orders.service.ts` |
| warehouseId | String | Yes | — | FK → Warehouse |
| subtotalUgx | Int | No | — | |
| shippingFeeUgx | Int | No | 0 | |
| discountUgx | Int | No | 0 | |
| vatUgx | Int | No | 0 | Uganda VAT (18%), broken out separately — collected on URA's behalf, not ChrisPa revenue |
| totalUgx | Int | No | — | |
| deliveryMethod | DeliveryMethod | No | STANDARD | |
| timeSlot | String | Yes | — | |
| paymentMethod | String | Yes | — | Only `CASH_ON_DELIVERY` completes; `MOBILE_MONEY`/`CARD` return 501 |
| shippingAddress | Json | No | — | |
| deliveryConfirmedAt | DateTime | Yes | — | Customer-only signal, separate from staff-set `status: DELIVERED` — "mutual consent" the printable receipt requires |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@index([userId])`, `@@index([warehouseId])`, `@@index([status])` |

### OrderItem

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| orderId | String | No | — | FK → Order, Cascade |
| productId | String | No | — | FK → Product |
| variantId | String | Yes | — | FK → Variant |
| qty | Int | No | — | |
| unitPriceUgx | Int | No | — | |
| vendorId | String | Yes | — | FK → Vendor; snapshotted at order time, not read live from Product |
| costUgxSnapshot | Int | Yes | — | |
| platformCommissionUgx | Int | Yes | — | Null until `RevenueRecognitionService` computes it at delivery |
| vendorPayoutUgx | Int | Yes | — | |
| vendorPayoutId | String | Yes | — | FK → VendorPayout; null = not yet paid out (guards against double-paying) |
| — | — | — | — | `@@index` on orderId, productId, vendorId, vendorPayoutId |

---

## Delivery (Driver App)

Added commit `75b7cff`, per user request — not in the original SRS. See
[`21-data-flow-diagram.md`](./21-data-flow-diagram.md)'s Driver App diagram and
[`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md) for the relationship/reassignment
semantics.

### Delivery

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| orderId | String | No | — | FK → Order, `@unique` — 1:1, no split-shipment support |
| driverId | String | No | — | FK → User (relation `DriverDeliveries`); the assigned driver, must have `role: DRIVER` |
| status | DeliveryStatus | No | ASSIGNED | See the `DeliveryStatus` enum below |
| priority | DeliveryPriority | No | NORMAL | Added commit `445a258` — set at assignment; a driver's own list sorts URGENT-first, ordering hint only, no automated dispatch reads it |
| pickupLat / pickupLng | Float | Yes | — | Snapshotted from the driver's browser geolocation at the moment `status` becomes `PICKED_UP` |
| pickedUpAt | DateTime | Yes | — | Set alongside pickupLat/pickupLng |
| deliveryLat / deliveryLng | Float | Yes | — | Snapshotted at `DELIVERED`, same reasoning as pickup |
| deliveredAt | DateTime | Yes | — | Set alongside deliveryLat/deliveryLng |
| currentLat / currentLng | Float | Yes | — | Last-known position while en route — a single overwritten snapshot, not a location-history table |
| lastLocationAt | DateTime | Yes | — | Timestamp of the last position update |
| notes | String | Yes | — | |
| assignedAt | DateTime | No | now() | |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@index([driverId])`, `@@index([status])` |

## Marketplace

### Vendor

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name | String | No | — | |
| contactEmail / contactPhone | String | Yes | — | |
| payoutMobileMoneyNumber | String | Yes | — | |
| commissionRatePercent | Decimal(5,2) | No | 20 | Platform's cut; read live at order-creation time, then snapshotted onto `OrderItem` |
| status | VendorStatus | No | ACTIVE | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### VendorPayout

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| vendorId | String | No | — | FK → Vendor |
| periodStart / periodEnd | DateTime | No | — | |
| grossSalesUgx / commissionUgx / payoutUgx | Int | No | — | Computed from that vendor's DELIVERED OrderItems, not recomputed live |
| status | VendorPayoutStatus | No | PENDING | Marking PAID is manual — no real disbursement integration |
| paidAt | DateTime | Yes | — | |
| createdAt | DateTime | No | now() | |

---

## Payments

### PaymentTransaction

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| orderId | String | Yes | — | FK → Order; nullable since a charge can be initiated before the order is confirmed |
| provider | PaymentProvider | No | — | Only `FLUTTERWAVE` |
| providerReference | String | No | — | `@unique`; our own idempotency key, sent as `tx_ref` — how the webhook maps back |
| providerTransactionId | String | Yes | — | |
| amountUgx | Int | No | — | |
| currency | String | No | "UGX" | |
| status | PaymentTransactionStatus | No | PENDING | |
| failureReason | String | Yes | — | |
| feeUgx | Int | Yes | — | Gateway fee, or a chargeback fee once disputed |
| createdAt / updatedAt | DateTime | No | now() / auto | |

---

## Marketing

### Coupon

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| code | String | No | — | `@unique` |
| type | CouponType | No | — | |
| value | Int | No | — | |
| usageCount | Int | No | 0 | |
| isActive | Boolean | No | true | |
| expiresAt | DateTime | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### Bundle

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name | String | No | — | |
| productIds | String[] | No | — | Scalar array, not a join table — no referential integrity, deliberate for this small feature |
| bundlePriceUgx | Int | No | — | |
| isActive | Boolean | No | true | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### NewsletterSubscriber

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| email | String | No | — | `@unique` |
| isActive | Boolean | No | true | |
| subscribedAt | DateTime | No | now() | |
| unsubscribedAt | DateTime | Yes | — | Kept, not hard-deleted on unsubscribe — preserves history and lets a re-subscribe flip it back on |

### NewsletterCampaign

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| subject / body | String | No | — | |
| recipientCount | Int | No | 0 | Snapshot of active subscriber count at send time |
| notifiedUserCount | Int | No | 0 | How many also got an in-app `Notification` |
| sentAt | DateTime | No | now() | Sent immediately on creation — not a draft/scheduling system |

---

## Loyalty

### LoyaltyAccount

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | `@unique`, FK → User, Cascade |
| pointsBalance | Int | No | 0 | |
| tier | CustomerTier | No | STANDARD | |

### LoyaltyLedgerEntry

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| loyaltyAccountId | String | No | — | FK → LoyaltyAccount, Cascade |
| delta | Int | No | — | Signed — award or reversal |
| reason | String | No | — | |
| orderId | String | Yes | — | FK → Order |
| createdAt | DateTime | No | now() | |

---

## Notifications

See `Notification` under **Identity & auth** above (kept there since it's a direct `User` relation) —
treated as its own domain in `03-database-design.md`'s inventory table.

---

## CRM / support

### Review

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| productId | String | No | — | FK → Product, Cascade |
| userId | String | No | — | FK → User, Cascade |
| rating | Int | No | — | |
| body | String | No | — | |
| photos | String[] | No | `[]` | |
| createdAt | DateTime | No | now() | |

### SupportTicket

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| orderId | String | Yes | — | FK → Order |
| body | String | No | — | |
| status | TicketStatus | No | OPEN | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### TicketMessage

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| ticketId | String | No | — | FK → SupportTicket, Cascade |
| authorUserId | String | No | — | FK → User, Cascade — either party |
| authorRole | UserRole | No | — | Snapshotted at write time — a later role change shouldn't repaint an old message's bubble |
| body | String | No | — | |
| createdAt | DateTime | No | now() | |

### WishlistItem

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | No | — | FK → User, Cascade |
| productId | String | No | — | FK → Product, Cascade |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@unique([userId, productId])` |

---

## CMS

### CmsPage

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| slug | String | No | — | `@unique` |
| title / body | String | No | — | |
| status | CmsStatus | No | DRAFT | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### Banner

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| imageUrl | String | No | — | |
| linkUrl | String | Yes | — | |
| sortOrder | Int | No | 0 | |
| isActive | Boolean | No | true | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### BlogPost

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| slug | String | No | — | `@unique` |
| title / body | String | No | — | |
| status | CmsStatus | No | DRAFT | Read-only from the admin side today — no write endpoint yet |
| publishedAt | DateTime | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### SocialMediaAccount

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| platform | String | No | — | Free text, not an enum — no icon library, rendered as a text label regardless |
| url | String | No | — | |
| isActive | Boolean | No | true | |
| sortOrder | Int | No | 0 | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

---

## HR — org (Departments, Employee Profiles, Documents)

### Department

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name | String | No | — | `@unique` |
| description | String | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### DepartmentPermission

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| departmentId | String | No | — | FK → Department, Cascade |
| resource | PermissionResource | No | — | One row per admin nav area |
| canView / canCreate / canUpdate / canDelete / canExecute | Boolean | No | false | A **stored policy record**, not the enforcement mechanism — `RolesGuard`/`@Roles()` is the real security boundary, by explicit user decision |
| updatedAt | DateTime | No | auto | |
| — | — | — | — | `@@unique([departmentId, resource])` — every department always has a complete 15-row matrix |

### Employee

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| userId | String | Yes | — | `@unique`, FK → User; optional both ways — see `22-entity-relationship-diagram.md` |
| employeeNumber | String | No | — | `@unique`, auto-generated |
| firstName / lastName | String | No | — | |
| personalEmail / personalPhone | String | Yes | — | |
| dateOfBirth | DateTime | Yes | — | |
| gender | String | Yes | — | |
| nationalIdNumber | String | Yes | — | Uganda National ID — access restricted to OWNER/HR_MANAGER at the API layer |
| address | String | Yes | — | |
| photoUrl | String | Yes | — | |
| departmentId | String | Yes | — | FK → Department |
| jobTitle | String | No | — | |
| employmentType | EmploymentType | No | FULL_TIME | |
| employmentStatus | EmploymentStatus | No | ACTIVE | Never hard-deleted — TERMINATED is the "delete" |
| hireDate | DateTime | No | — | |
| terminationDate | DateTime | Yes | — | |
| managerId | String | Yes | — | FK → Employee (self) |
| baseSalaryUgx | Int | Yes | — | Payroll input |
| nssfNumber / tinNumber | String | Yes | — | |
| annualLeaveDaysPerYear | Int | No | 21 | Uganda Employment Act 2006 statutory minimum |
| standardHoursPerDay | Int | No | 8 | Overtime calculation input |
| overtimeRateMultiplier | Float | No | 1.5 | Plain multiplier, not a percentage |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@index` on departmentId, managerId, employmentStatus |

### EmploymentHistoryEntry

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| changeType | EmploymentChangeType | No | — | Auto-logged by `EmployeesService.update()`'s diff |
| previousValue / newValue | String | Yes | — | |
| effectiveDate | DateTime | No | — | |
| notes | String | Yes | — | |
| createdAt | DateTime | No | now() | |

### EmployeeDocument

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| type | EmployeeDocumentType | No | — | |
| title | String | No | — | |
| fileUrl | String | No | — | |
| expiresAt | DateTime | Yes | — | Drives the "documents expiring in 30 days" dashboard metric |
| uploadedAt | DateTime | No | now() | |

---

## HR — attendance / leave / shifts

### TimeEntry

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| clockIn | DateTime | No | — | |
| clockOut | DateTime | Yes | — | |
| source | AttendanceSource | No | WEB | Only value — no biometric/device integration |
| notes | String | Yes | — | |
| createdAt | DateTime | No | now() | |

### LeaveRequest

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| type | LeaveType | No | — | |
| startDate / endDate | DateTime | No | — | |
| reason | String | Yes | — | |
| status | LeaveRequestStatus | No | PENDING | |
| reviewedByUserId | String | Yes | — | FK → User |
| reviewNotes | String | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### Shift

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| startAt / endAt | DateTime | No | — | |
| role | String | Yes | — | |
| status | ShiftStatus | No | SCHEDULED | |
| notes | String | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### ShiftSwapRequest

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| shiftId | String | No | — | FK → Shift, Cascade |
| requestedByEmployeeId | String | No | — | FK → Employee |
| coverEmployeeId | String | No | — | FK → Employee; approval reassigns `Shift.employeeId` to this employee |
| status | ShiftSwapStatus | No | PENDING | |
| reviewedByUserId | String | Yes | — | FK → User |
| reason | String | Yes | — | |
| createdAt | DateTime | No | now() | |

---

## HR — performance & recruitment

### PerformanceGoal

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| title | String | No | — | |
| description | String | Yes | — | |
| targetDate | DateTime | Yes | — | |
| status | GoalStatus | No | NOT_STARTED | |
| progressPercent | Int | No | 0 | |
| createdByUserId | String | No | — | FK → User — OWNER/HR_MANAGER or the employee's line manager |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### PerformanceFeedback

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| givenByUserId | String | No | — | FK → User |
| note | String | No | — | Lightweight, immutable — distinct from the formal `PerformanceReview` |
| createdAt | DateTime | No | now() | |

### PerformanceReview

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| reviewerUserId | String | No | — | FK → User |
| periodStart / periodEnd | DateTime | No | — | |
| rating | Int | Yes | — | 1–5 |
| strengths / areasForImprovement / overallComments | String | Yes | — | |
| status | ReviewStatus | No | DRAFT | SUBMITTED locks content — only the employee's own `acknowledge()` can move it to ACKNOWLEDGED |
| acknowledgedAt | DateTime | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### JobPosting

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| title | String | No | — | |
| departmentId | String | Yes | — | FK → Department |
| description / requirements | String | Yes | — | |
| employmentType | EmploymentType | No | FULL_TIME | |
| status | JobPostingStatus | No | DRAFT | Auto-transitions to FILLED on applicant conversion |
| createdByUserId | String | Yes | — | FK → User |
| postedAt / closedAt | DateTime | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### Applicant

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| jobPostingId | String | No | — | FK → JobPosting, Cascade |
| firstName / lastName / email | String | No | — | |
| phone / resumeUrl / coverNote | String | Yes | — | |
| stage | ApplicantStage | No | APPLIED | |
| notes | String | Yes | — | Internal HR notes, not shown to the applicant |
| convertedEmployeeId | String | Yes | — | `@unique`, FK → Employee; guards against double-conversion |
| appliedAt / updatedAt | DateTime | No | now() / auto | |

---

## HR — payroll

### PayrollPeriod

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| month | DateTime | No | — | First-of-month; Dec 1 of the target year for THIRTEENTH_MONTH |
| type | PayrollPeriodType | No | REGULAR | |
| status | PayrollPeriodStatus | No | DRAFT | DRAFT → COMPUTED → FINALIZED |
| createdByUserId | String | No | — | FK → User |
| createdAt | DateTime | No | now() | |
| finalizedAt | DateTime | Yes | — | |
| — | — | — | — | `@@unique([month, type])` — lets a REGULAR and THIRTEENTH_MONTH period coexist in the same month |

### Payslip

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| periodId | String | No | — | FK → PayrollPeriod, Cascade |
| employeeId | String | No | — | FK → Employee |
| basicSalaryUgx | Int | No | — | Snapshotted — prorated for THIRTEENTH_MONTH |
| taxableAllowancesUgx / nonTaxableAllowancesUgx | Int | No | 0 | |
| overtimeUgx / bonusUgx | Int | No | 0 | |
| grossPayUgx | Int | No | — | Display total (taxable gross + non-taxable allowances) |
| payeTaxUgx | Int | No | — | |
| nssfEmployeeUgx / nssfEmployerUgx | Int | No | — | Computed on `basicSalaryUgx` only — documented simplification |
| penaltyUgx / advanceRepaymentUgx | Int | No | 0 | |
| netPayUgx | Int | No | — | |
| computedAt | DateTime | No | now() | |
| — | — | — | — | `@@unique([periodId, employeeId])` |

### EmployeeAllowance

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee, Cascade |
| type | AllowanceType | No | OTHER | |
| label | String | Yes | — | |
| amountUgx | Int | No | — | |
| taxable | Boolean | No | true | Controls PAYE-chargeable vs. straight-to-net |
| active | Boolean | No | true | Applied to every regular run while active |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### SalaryAdvance

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| employeeId | String | No | — | FK → Employee |
| principalUgx | Int | No | — | |
| balanceRemainingUgx | Int | No | — | Only decremented at `PayrollService.finalize()` — re-running a not-yet-finalized period doesn't mutate it |
| monthlyInstallmentUgx | Int | No | — | |
| status | SalaryAdvanceStatus | No | ACTIVE | |
| issuedAt | DateTime | No | now() | |
| approvedByUserId | String | No | — | FK → User |
| note | String | Yes | — | |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### PayslipAdvanceRepayment

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| payslipId | String | No | — | FK → Payslip, Cascade |
| advanceId | String | No | — | FK → SalaryAdvance |
| amountUgx | Int | No | — | Snapshotted per payslip, not recomputed at finalize time |

### PayrollAdjustment

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| periodId | String | No | — | FK → PayrollPeriod, Cascade |
| employeeId | String | No | — | FK → Employee |
| type | PayrollAdjustmentType | No | — | |
| label | String | No | — | |
| amountUgx | Int | No | — | |
| taxable | Boolean | No | true | Only meaningful for BONUS/OVERTIME/OTHER_EARNING — deductions are always post-tax |
| createdByUserId | String | No | — | FK → User |
| createdAt | DateTime | No | now() | |

---

## Activity log / audit trail

### ActivityLog

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| actorUserId | String | Yes | — | **Not a real FK** — plain string, snapshotted |
| actorRole | UserRole | Yes | — | Snapshotted — a later role change doesn't rewrite past entries |
| actorType | ActivityActorType | No | — | CUSTOMER / STAFF / SYSTEM |
| action | String | No | — | Machine-readable code, e.g. `CUSTOMER_SUSPENDED`, `ORDER_STATUS_CHANGED` |
| entityType / entityId | String | Yes | — | |
| description | String | No | — | |
| metadata | Json | Yes | — | Must never contain passwords/tokens/secrets |
| ipAddress / userAgent | String | Yes | — | |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@index` on actorUserId, `[entityType, entityId]`, action, createdAt |

---

## Financial & accounting (multi-entity)

### LegalEntity

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| name / code | String | No | — | Both `@unique` |
| functionalCurrency | String | No | — | ISO 4217 |
| parentEntityId | String | Yes | — | FK → LegalEntity (self); null = the group's ultimate parent |
| currentGroupFxRate | Decimal(18,6) | No | 1 | No live FX feed — re-priced manually; period-snapshotting is follow-up work |
| createdAt / updatedAt | DateTime | No | now() / auto | |

### GroupSettings

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| reportingCurrency | String | No | "UGX" | Singleton — always read as the first row, no UI/API to create a second |
| updatedAt | DateTime | No | auto | |

### Account

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| entityId | String | No | — | FK → LegalEntity |
| code / name | String | No | — | |
| type | AccountType | No | — | ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE |
| parentAccountId | String | Yes | — | FK → Account (self) |
| cashFlowCategory | CashFlowCategory | Yes | — | Only meaningful for ASSET/LIABILITY |
| isIntercompany | Boolean | No | false | |
| counterpartyEntityId | String | Yes | — | FK → LegalEntity — marks which entity an intercompany account nets against |
| isActive | Boolean | No | true | |
| createdAt / updatedAt | DateTime | No | now() / auto | |
| — | — | — | — | `@@unique([entityId, code])` |

### FiscalPeriod

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| entityId | String | No | — | FK → LegalEntity |
| month | DateTime | No | — | First of month, UTC-midnight |
| status | FiscalPeriodStatus | No | OPEN | Journal entries can only post into an OPEN period |
| closedAt | DateTime | Yes | — | |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@unique([entityId, month])` |

### JournalEntry

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| entityId | String | No | — | FK → LegalEntity |
| fiscalPeriodId | String | No | — | FK → FiscalPeriod |
| entryNumber | Int | No | — | Sequential per entity — same race-window caveat as `Order.orderNumber` |
| date | DateTime | No | — | |
| description | String | No | — | |
| status | JournalEntryStatus | No | POSTED | |
| fxRateToGroupCurrency | Decimal(18,6) | No | — | Snapshotted at posting time |
| intercompanyGroupId | String | Yes | — | Links the linked entries of one intercompany transaction across entities |
| createdByUserId | String | No | — | Plain string, not a `@relation` (unusual for this schema — see the ERD doc's callout list) |
| createdAt | DateTime | No | now() | |
| — | — | — | — | `@@unique([entityId, entryNumber])` |

### JournalEntryLine

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| journalEntryId | String | No | — | FK → JournalEntry, Cascade |
| accountId | String | No | — | FK → Account |
| debitAmount / creditAmount | Decimal(18,2) | No | 0 | Exactly one non-zero — enforced in `JournalService`, not a DB constraint |
| memo | String | Yes | — | |

---

## Marketplace & payments (cont'd) — Exchange rate audit

### ExchangeRateHistory

| Field | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| legalEntityId | String | No | — | **Not a real FK** — plain string |
| fromRate / toRate | Decimal(18,6) | No | — | |
| changedByUserId | String | No | — | **Not a real FK** — plain string |
| changedAt | DateTime | No | now() | Written every time `LegalEntity.currentGroupFxRate` changes — the audit trail of how the live rate got there |

---

## Enums

| Enum | Values | Purpose |
|---|---|---|
| UserRole | CUSTOMER, OWNER, STORE_MANAGER, FULFILLMENT, SUPPORT_AGENT, HR_MANAGER, DRIVER | Access-control role, staff + customer. `DRIVER` added commit `75b7cff` (Driver App, not in original SRS) |
| CustomerTier | STANDARD, GOLD, WHOLESALE | Loyalty/pricing tier |
| NotificationType | NEWSLETTER | In-app notification discriminator |
| OtpChannel | EMAIL, SMS | Registration OTP delivery channel |
| OtpPurpose | REGISTRATION | Only value in use |
| AddressType | SHIPPING, BILLING | Scopes `Address.isDefault` |
| PaymentMethodType | MOBILE_MONEY, CARD, PAYPAL | Only MOBILE_MONEY fully supported |
| ProductStatus | DRAFT, ACTIVE, ARCHIVED | ARCHIVED replaces hard-delete once order history exists |
| OrderStatus | PENDING, PROCESSING, SHIPPED, DELIVERED, REFUND_REQUESTED, REFUNDED, CANCELLED | Governed by an explicit transition state machine |
| DeliveryStatus | ASSIGNED, EN_ROUTE_TO_PICKUP, PICKED_UP, EN_ROUTE_TO_CUSTOMER, DELIVERED, FAILED | Driver App (commit `75b7cff`, not in original SRS) — `PICKED_UP`/`DELIVERED` mirror onto `Order.status` (SHIPPED/DELIVERED respectively); `FAILED` reachable from any in-progress state, terminal like `DELIVERED` |
| DriverStatus | OFFLINE, AVAILABLE, ON_DELIVERY | Added commit `445a258` — self-reported driver availability, `User.driverStatus` |
| DeliveryPriority | NORMAL, URGENT | Added commit `445a258` — set at assignment, ordering hint for the driver's own list |
| DeliveryMethod | STANDARD, EXPRESS, SAME_DAY | |
| CouponType | PERCENT_OFF, FIXED_OFF, FREE_SHIPPING | |
| TicketStatus | OPEN, IN_PROGRESS, RESOLVED, CLOSED | |
| CmsStatus | DRAFT, PUBLISHED | Shared by CmsPage/BlogPost |
| EmploymentType | FULL_TIME, PART_TIME, CONTRACT, INTERN | |
| EmploymentStatus | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED | TERMINATED is the "delete" for Employee |
| EmploymentChangeType | HIRED, PROMOTION, TRANSFER, SALARY_CHANGE, ROLE_CHANGE, SUSPENSION, REINSTATEMENT, TERMINATION, REHIRE | Drives auto-logged `EmploymentHistoryEntry` rows |
| EmployeeDocumentType | CONTRACT, ID_DOCUMENT, CERTIFICATE, PERFORMANCE_NOTE, OTHER | |
| PermissionResource | PRODUCTS, ORDERS, INVENTORY, CUSTOMERS, MARKETING, CMS, SETTINGS, HR_DASHBOARD, HR_EMPLOYEES, HR_ATTENDANCE, HR_LEAVE, HR_SHIFTS, HR_RECRUITMENT, HR_PAYROLL, HR_PERFORMANCE | One per admin nav area — mirrors `admin-shell.tsx` exactly |
| AttendanceSource | WEB | Only value — no biometric/device integration |
| LeaveType | ANNUAL, SICK, MATERNITY, PATERNITY, UNPAID, OTHER | |
| LeaveRequestStatus | PENDING, APPROVED, REJECTED, CANCELLED | |
| ShiftStatus | SCHEDULED, CANCELLED | |
| ShiftSwapStatus | PENDING, APPROVED, REJECTED, CANCELLED | |
| GoalStatus | NOT_STARTED, IN_PROGRESS, COMPLETED, MISSED | |
| ReviewStatus | DRAFT, SUBMITTED, ACKNOWLEDGED | SUBMITTED locks content until the employee acknowledges |
| JobPostingStatus | DRAFT, OPEN, CLOSED, FILLED | Auto-transitions to FILLED on applicant conversion |
| ApplicantStage | APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED | |
| PayrollPeriodStatus | DRAFT, COMPUTED, FINALIZED | FINALIZED locks the period; advance-ledger balances commit here |
| PayrollPeriodType | REGULAR, THIRTEENTH_MONTH | Separate proration rule, excludes allowances/overtime/bonus/advance recovery |
| AllowanceType | HOUSING, TRANSPORT, LUNCH, MEDICAL, HARDSHIP, OTHER | |
| SalaryAdvanceStatus | ACTIVE, PAID_OFF, CANCELLED | |
| PayrollAdjustmentType | BONUS, PENALTY, OVERTIME, OTHER_EARNING, OTHER_DEDUCTION | |
| ActivityActorType | CUSTOMER, STAFF, SYSTEM | |
| AccountType | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE | |
| CashFlowCategory | OPERATING, INVESTING, FINANCING | Drives the indirect-method cash flow statement |
| FiscalPeriodStatus | OPEN, CLOSED | |
| JournalEntryStatus | DRAFT, POSTED | |
| VendorStatus | ACTIVE, SUSPENDED | |
| VendorPayoutStatus | PENDING, PAID | |
| PaymentProvider | FLUTTERWAVE | Only integrated gateway |
| PaymentTransactionStatus | PENDING, SUCCESSFUL, FAILED, REFUNDED, CHARGEBACK | |
