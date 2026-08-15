# 07. Authentication and Authorization

Auth is the most complete, end-to-end module in the API — this document is the authoritative summary; the
code comments in `apps/api/src/modules/auth` (especially `two-factor.service.ts`, `webauthn.service.ts`, and
`AuthService.issueTokens()`) carry the detailed reasoning.

## Credential login and tokens

- `POST /api/v1/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`,
  `GET /auth/me` — JWT access + rotating refresh tokens.
- Passwords are hashed with **bcrypt** (correct for low-entropy, human-chosen secrets).
- Refresh tokens are hashed with **SHA-256, not bcrypt** — bcrypt silently truncates input at 72 bytes, and
  these JWTs share an identical prefix (header + `sub` claim) well past that length for a given user, so
  bcrypt-hashing them made every refresh token issued to the same user collide onto the same truncated hash,
  silently defeating both rotation and revocation. This was live and unnoticed until logout was added and
  tested. **Rule of thumb for this codebase**: high-entropy tokens/secrets get `createHash('sha256')` (or
  similar); bcrypt is for passwords specifically.
- Access tokens are short-lived (15 min, `JWT_ACCESS_TTL`); refresh tokens live 30 days
  (`JWT_REFRESH_TTL_DAYS`) and rotate on each use.

## Registration OTP (email + SMS)

`POST /auth/register` (FR-9) creates the `User` row but deliberately returns **no tokens** — it's a hard
verification gate, not a self-completing signup. `OtpService.issue()` sends a 6-digit code to both channels
in parallel: email via `MailService` (Brevo's transactional HTTP API — **not SMTP**, see the production-status
callout below for why) and phone via `SmsService` (Africa's Talking, the Uganda/East-Africa-native SMS
gateway chosen over Twilio for this project). The account cannot log in
(`POST /auth/login` returns `{ requiresVerification: true, userId }` in place of tokens) until
`POST /auth/verify-otp` confirms **both** channels — `AuthService.verifyOtp()` is the only path that
actually completes that login, mirroring `changePassword()`'s "issue tokens right after the gate that was
blocking them clears" shape.

Codes are hashed at rest with the same `createHash('sha256')` convention as refresh tokens (see below) —
overkill-adjacent for a 6-digit value, but free given the code is already rate-limited, short-lived, and
single-use, and it keeps a DB read from directly leaking a valid code. They expire after `OTP_TTL_MINUTES`
(10 by default), lock out after 5 wrong attempts, and are rate-limited to one send per 30 seconds per channel
independent of the controller-level `@Throttle` (`POST /auth/resend-otp`).

**Neither `MailService` nor `SmsService` is a stub** — both are real, working integrations, gated on their
own env vars (`BREVO_API_KEY`/`EMAIL_FROM_ADDRESS`/`EMAIL_FROM_NAME`, `AT_USERNAME`/`AT_API_KEY`) with a
documented, graceful fallback: if unset (a fresh local dev checkout, or a deliberately provider-less
environment), both services log the would-be message instead of throwing, so registration still works
end-to-end in dev without ever sending a real email or SMS. This is a materially different state from the "no
delivery provider exists" gap this section used to describe — see Known gaps below for what's *actually*
still blocked on that concern (forgot-password, login-alert delivery, admin invites, staff temp-password
delivery — none of them call `MailService`/`SmsService` yet, but the services themselves are no longer the
missing piece).

> **Production status (confirmed, working)**: both channels are live in production, verified end-to-end (a
> real registration returns `201` in ~8 seconds with both codes delivered). Getting here took three real
> fixes, in order:
>
> 1. **Neither provider was configured at all** (initial state) — both services silently logged codes to
>    Render's server logs instead of sending them, so every registration created a real account with no way
>    for the customer to receive either code. This is logged as incident #2 in
>    [`13-incident-response-and-troubleshooting.md`](./13-incident-response-and-troubleshooting.md).
> 2. **`MailService` originally used generic SMTP via `nodemailer`** (Gmail app password, then Brevo's SMTP
>    relay as a second attempt) — both failed identically, ~45s "Connection timeout" on every send. Root
>    cause: **Render blocks all outbound SMTP traffic (ports 25/465/587) on free-tier web services**, a
>    platform policy since September 2025 — not a credentials or DNS problem, and no per-provider workaround
>    fixes it. `MailService` was rewritten to call Brevo's transactional HTTP API (`POST
>    https://api.brevo.com/v3/smtp/email`, plain HTTPS, unaffected by the port block) instead of SMTP
>    entirely, dropping the `nodemailer` dependency. This trades away the earlier "any SMTP account works"
>    generality for staying on Render's free plan.
> 3. **`AuthService.register()` had no error handling around the OTP dispatch** — `Promise.all` meant a real
>    provider error (as opposed to "not configured", which was already handled) crashed the whole request
>    with a bare `500`, after the `User` row was already committed — an orphaned unverified account and a
>    failed request, confirmed live when Africa's Talking briefly rejected a freshly-generated sandbox API key
>    with `401` (new keys take a few minutes to propagate). Switched to `Promise.allSettled` with per-channel
>    error logging, so a delivery failure on either channel degrades gracefully instead of crashing —
>    registration still succeeds, and `POST /auth/resend-otp` gives a real second chance once whatever caused
>    the failure clears.

**"Sign in/up with Google" (FR-8.4/FR-9.4)** is the one path that skips registration OTP entirely — Google
has already verified the email server-side, which is the same authority `emailVerifiedAt` otherwise records.
`POST /auth/google` takes an ID token straight from Google Identity Services running client-side, and
`AuthService.googleLogin()` verifies its signature and audience (`google-auth-library`'s `verifyIdToken()`)
before trusting any claim in it — never a client secret. An existing account matched by email gets the
Google identity linked onto it (backfilling `emailVerifiedAt` if it was somehow unset); no match creates a
new account outright, verified and logged in immediately. Gated on `GOOGLE_CLIENT_ID`
(`config.get('google.clientId')`) being set — `googleLogin()` throws a clear "Google sign-in is not
configured" `UnauthorizedException` otherwise, matching the frontend's own `GoogleSignInButton`, which
renders nothing at all if `NEXT_PUBLIC_GOOGLE_CLIENT_ID` isn't set (same env var value on both sides — see
[`05-frontend-architecture.md`](./05-frontend-architecture.md)).

Frontend: `/login`, `/signup`, and the embedded forms at `/account` (FR-11.4, storefront only) all wire up
identically — a shared `OtpVerify` component (`apps/storefront/src/components/auth/otp-verify.tsx`) renders
the two-channel code-entry step, reused for both the signup flow (codes already sent by `register()`) and
the login flow (an existing account that never finished verifying — `login()`'s `requiresVerification` gate
re-issues fresh codes on mount, since the original ones may be long expired), and a shared
`GoogleSignInButton` (`google-signin-button.tsx`) renders Google Identity Services' own button and posts its
credential straight to `POST /auth/google`.

## Two-factor authentication (TOTP)

`TwoFactorService` (`apps/api/src/modules/auth/two-factor.service.ts`) implements FR-17.1, **fully enforced
at login**: `POST /auth/2fa/enroll` generates a secret (returned once as a QR code, not stored in plaintext
after the response), `POST /auth/2fa/confirm` proves the user actually scanned it before enabling, and
`POST /auth/login/2fa` completes a login that `POST /auth/login` flagged as requiring a second factor. TOTP
was buildable without any external delivery channel, unlike login-alert notifications (see Known gaps) —
registration OTP above needed one too, and now has one (`MailService`/`SmsService`), just not for this
purpose.

**A real gap this exposed**: `AuthService.login()` decides `requiresTwoFactor: true` purely from the
`twoFactorEnabled` flag, with no check that a `twoFactorSecret` actually exists — and the only enrollment
path, `POST /auth/2fa/enroll`, requires an access token, which login refuses to issue while stuck in that
state. An account with the flag set but no secret is therefore **permanently locked out**, with no
self-service or admin-side recovery: there is no `OWNER`/`HR_MANAGER` route to reset another user's 2FA
(confirmed by code review — the only writes to `twoFactorEnabled`/`twoFactorSecret` anywhere in `apps/api/src`
are the self-service enroll/confirm/disable methods on `TwoFactorService` itself, plus the unrelated
downgrade path in `account-settings.service.ts`). This is exactly the state `apps/api/prisma/seed.ts` leaves
`chris@chrispa.ug` (`OWNER`), `patricia@chrispa.ug` (`STORE_MANAGER`), and `grace@chrispa.ug` (`HR_MANAGER`)
in — it sets `twoFactorEnabled: true` for all three but never seeds a `twoFactorSecret`. This is a pre-existing
seed-data gap, not something introduced alongside the production deploy.

**Production status**: all three accounts now have real, working TOTP secrets in production, bootstrapped via
a reviewable one-off script (`apps/api/prisma/seed-totp.ts`, added and removed as paired commits per account:
`76621e1`/`df5040f` for `chris@chrispa.ug`, `344780e`/`5806bf7` for `patricia@chrispa.ug` and
`grace@chrispa.ug`) that reused `TwoFactorService`'s own `otplib`/`encryptTotpSecret` code paths — the result
is indistinguishable from a real self-service enrollment, just without a human present to submit the
confirming code back. Run once via a temporary Render build-command step (see
[`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md) for that
pattern), then the script was deleted from the repo both times so it can't accidentally regenerate and
overwrite a secret later. The plaintext secrets themselves were relayed to the account owner directly, not
stored in any document or committed to the repo. **Anyone logging into the OWNER/STORE_MANAGER/HR_MANAGER
demo accounts in production now needs a TOTP authenticator app enrolled for that account** — `dennis@chrispa.ug`
(`FULFILLMENT`) and `brenda@chrispa.ug` (`SUPPORT_AGENT`) still have `twoFactorEnabled: false` from seed data
and log in normally. The same lockout applies to any **local** database seeded fresh from current `seed.ts`
(e.g. after `prisma migrate reset && npm run db:seed`) — it is not production-specific, just went unnoticed
locally because an existing, already-diverged local `chris` row predated the `twoFactorEnabled: true` change
and `upsert`'s `update: {}` branch never overwrote it (see the seed-data note in
[`03-database-design.md`](./03-database-design.md)).

## WebAuthn / passkeys

`webauthn.controller.ts` + `webauthn.service.ts` implement `@simplewebauthn/server`-backed passkey
registration and login (`/auth/webauthn/register/options`, `/register/verify`, `/login/options`,
`/login/verify`, `/disable`), backed by the `WebAuthnCredential` model. This is real, working biometric/
hardware-key login, not a placeholder.

## RBAC

- `UserRole` enum: `OWNER`, `STORE_MANAGER`, `FULFILLMENT`, `SUPPORT_AGENT`, `HR_MANAGER`, `DRIVER`, `CUSTOMER`.
- Enforced by `JwtAuthGuard` (authentication — verifies the JWT signature) and `RolesGuard` + `@Roles()`
  (authorization — gates `/admin/*` and `/hr/*` routes). This guard pair is the **real security boundary**
  everywhere in the API.
- See [`06-api-design-and-documentation.md`](./06-api-design-and-documentation.md) for the route-to-role
  mapping.
- **`SUPPORT_AGENT`** existed in the enum from the start but had no endpoint gated to it until Support Ticket
  review/response (`docs/SRS.md` FR-7.4) — `AdminSupportController`'s `@Roles('OWNER', 'STORE_MANAGER',
  'SUPPORT_AGENT')` at `/admin/support/tickets` is its first real consumer. The admin console mirrors this: a
  `SUPPORT_AGENT` sees only **Support Tickets** plus **My HR** in the sidenav (`visibleSections()` in
  `admin-shell.tsx`), the smallest nav footprint of any staff role.
- **`DRIVER`** (added this session, commit `75b7cff` — Driver App, per user request, not in the original SRS):
  a staff login created the same way as every other role (added to `STAFF_ROLES` in
  `hr/dto/create-login.dto.ts`, so it goes through the normal Employee + `createLoginInternal()` flow — temp
  password, `mustChangePassword`, no separate onboarding path). Scoped narrowly: `MyDeliveriesController`
  (`/driver/deliveries/*`) is `@Roles('DRIVER')` and every method is additionally ownership-checked
  (`findFirst({ id, driverId })`) so a driver only ever sees their own assigned `Delivery` rows, same pattern
  as the customer self-service modules (wishlist/addresses/payment-methods). Assigning a driver to an order
  (`PATCH /admin/orders/:id/assign-driver`) is gated the same as order management itself —
  `@Roles('OWNER', 'STORE_MANAGER', 'FULFILLMENT')` — not a `DRIVER` permission. The admin console mirrors
  this: a `DRIVER` sees only **My Deliveries** plus **My HR** in the sidenav, the same "own section + My HR"
  shape `SUPPORT_AGENT` gets above. See [`16-user-and-administrator-procedures.md`](./16-user-and-administrator-procedures.md)
  for the actual assign/pickup/deliver walkthrough and [`22-entity-relationship-diagram.md`](./22-entity-relationship-diagram.md)
  for `Delivery`'s relationship to `Order`/`User`.

## Forced password reset for staff-issued logins

When `OWNER`/`HR_MANAGER` creates an employee with a login (or grants one to an existing employee via
`POST /hr/employees/:id/create-login`), `EmployeesService.createLoginInternal()` generates a one-time
temporary password (`common/util/temp-password.util.ts`, `crypto.randomInt`-based), hashes it, and sets
`User.mustChangePassword: true`. The plaintext is returned **once**, in that single API response, and never
stored or logged — this path isn't wired to `MailService`/`SmsService` (see Registration OTP above) to send
it through instead, so an OWNER/HR_MANAGER still has to relay it out-of-band (same gap noted under Known
gaps).

The flag rides in the JWT payload and is enforced globally by `MustChangePasswordGuard` (registered via
`APP_GUARD`, so it cannot be forgotten on a new module) — it blocks every endpoint except
`/auth/change-password`, `/auth/logout`, and `/auth/me` until the temp password is replaced.
`MustChangePasswordGuard` deliberately only *decodes* the JWT's claim (no signature check, no DB call) —
`JwtAuthGuard` still verifies the signature per-controller afterward, so a tampered token is rejected there
regardless of what the decode-only check decided. `POST /auth/change-password` verifies the current
password, clears the flag, and reissues tokens immediately.

Only an `OWNER` can grant the `OWNER` role through this flow — `HR_MANAGER` is blocked from minting new
Owner accounts.

## Department permissions — a policy record, not the enforcement mechanism

`DepartmentPermission` (one row per `Department` × `PermissionResource`, with `canView`/`canCreate`/
`canUpdate`/`canDelete`/`canExecute` booleans, editable via `PATCH /hr/departments/:id/permissions`) is a
**stored, documented policy record — by explicit decision, it does not enforce anything itself**. The real
authorization boundary remains `RolesGuard` checking `UserRole` on every endpoint, as above. Seed data
pre-populates the four real departments to mirror the actual `@Roles()` enforcement exactly, so the two
never contradict each other in the seeded state — but a future edit to one does not change the other.

## Frontend enforcement (UX only, not security)

`getMustChangePassword()`/`getUserRole()` in each frontend app's `lib/auth-client.ts` decode the JWT
client-side to drive redirects and nav visibility — this exists purely to avoid landing a user on a page full
of failed requests; it is not a security control (see
[`05-frontend-architecture.md`](./05-frontend-architecture.md)). Same reasoning for the admin console's root
page (`/`), which now checks `getAccessToken()` and redirects a signed-out visitor to `/login` — cosmetic
routing only; every `/admin/*` request the dashboard (or any other admin page) would have made is still
independently rejected by `JwtAuthGuard`/`RolesGuard` on the API regardless of what the frontend redirects to.

## Known gaps

- **No forgot-password flow** — `/forgot-password`/`/reset-password` are disabled UI stubs, no API endpoint.
  No longer blocked on a missing delivery provider (`MailService`/`SmsService` exist and are real, see
  above) — it's a distinct feature that hasn't been wired to them, a smaller gap than it used to be. Until
  it exists, a forgotten customer password has no self-service recovery path at all (staff can be re-issued
  a temp password via `POST /hr/employees/:id/create-login`, but that's an OWNER/HR_MANAGER action, not
  self-service, and doesn't apply to customer accounts).
- **No login-alert delivery by SMS/email** — `LoginEvent`/new-device detection (FR-17.1) is real, but
  delivery is in-app only (a Settings-page banner), not a push through `MailService`/`SmsService` — same
  "provider exists, not wired to this trigger" shape as forgot-password above.
- **No admin-invite flow, no staff temp-password delivery by SMS/email** — a temp password is returned once
  in the API response only (see the class-level note in `EmployeesService.createLoginInternal()`); an
  OWNER/HR_MANAGER still has to relay it out-of-band. Also no longer blocked on a missing provider, same
  reasoning.
- **No OTP-as-login-credential mode, no Facebook/Apple social login, no Wholesale/Corporate SSO** (FR-8.1,
  FR-8.4/FR-9.4, FR-8.5) — distinct from the registration-OTP hard gate and Google sign-in described above,
  which are both implemented.
- No secrets manager for `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`TOTP_ENCRYPTION_KEY` — currently plain
  `.env` values, fine for one local environment, not for a shared one (see
  [`10-security-architecture.md`](./10-security-architecture.md)).
- No MFA enforcement policy for `OWNER`/`HR_MANAGER` accounts specifically (2FA is opt-in for all roles
  today) — worth revisiting now that a production environment exists, per the template's "use MFA where
  supported" guidance.
- **No admin-side 2FA reset for another user** — see the Two-factor authentication section above. Any account
  that ends up with `twoFactorEnabled: true` and no confirmed secret (a bad seed/migration, or a user who
  loses their authenticator device) is permanently locked out with no self-service or `OWNER`/`HR_MANAGER`
  recovery path today; the only fix currently available is a direct, reviewed database write (as done for the
  three demo accounts above), not a supported product feature. A real fix would add either an
  `OWNER`/`HR_MANAGER` "reset this user's 2FA" endpoint, or have `login()` check for a confirmed secret
  before returning `requiresTwoFactor: true` so a half-enrolled account falls through to a normal password
  login instead of locking out.
