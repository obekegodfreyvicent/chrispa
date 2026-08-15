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
in parallel: email via `MailService` (generic SMTP through `nodemailer` — any account works: Gmail app
password, a domain mailbox, Mailtrap for local dev) and phone via `SmsService` (Africa's Talking, the
Uganda/East-Africa-native SMS gateway chosen over Twilio for this project). The account cannot log in
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
own env vars (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, `AT_USERNAME`/`AT_API_KEY`) with a documented,
graceful fallback: if unset (a fresh local dev checkout, or a deliberately provider-less environment), both
services log the would-be message instead of throwing, so registration still works end-to-end in dev without
ever sending a real email or SMS. This is a materially different state from the "no delivery provider
exists" gap this section used to describe — see Known gaps below for what's *actually* still blocked on that
concern (forgot-password, login-alert delivery, admin invites, staff temp-password delivery — none of them
call `MailService`/`SmsService` yet, but the services themselves are no longer the missing piece).

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

## WebAuthn / passkeys

`webauthn.controller.ts` + `webauthn.service.ts` implement `@simplewebauthn/server`-backed passkey
registration and login (`/auth/webauthn/register/options`, `/register/verify`, `/login/options`,
`/login/verify`, `/disable`), backed by the `WebAuthnCredential` model. This is real, working biometric/
hardware-key login, not a placeholder.

## RBAC

- `UserRole` enum: `OWNER`, `STORE_MANAGER`, `FULFILLMENT`, `SUPPORT_AGENT`, `HR_MANAGER`, `CUSTOMER`.
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
  today) — worth revisiting once a production environment exists, per the template's "use MFA where
  supported" guidance.
