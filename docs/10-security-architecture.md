# 10. Security Architecture

Adapts template §20, checked against what's actually implemented.

## What's real today

| Control | State |
|---|---|
| Password hashing | bcrypt (correct algorithm for human-chosen secrets) |
| Refresh-token hashing | SHA-256 — deliberately not bcrypt; see [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md) for why bcrypt would silently break rotation/revocation here |
| Least-privilege access | `RolesGuard` + `@Roles()` on every admin/HR route, checked against `UserRole`; ownership checks (`findFirst({ id, userId })`) on every customer self-service write (wishlist, addresses, payment methods) before the row is touched — verified against a cross-user access attempt during testing |
| MFA | TOTP fully enforced at login when enabled (opt-in per user); WebAuthn/passkey login available as an alternative factor |
| Forced credential rotation | Staff-issued temp passwords force a change via `mustChangePassword`, enforced globally by `MustChangePasswordGuard` |
| Transport encryption | Not applicable in local dev (plain HTTP on `localhost`) — no TLS termination exists yet because nothing is deployed |
| Credential/secret storage in source | None committed — `.env` files are gitignored; `.env.example` documents required keys without real values |
| PCI scope avoidance | The API structurally cannot accept a raw card number — `CARD` payment method type returns `501` everywhere it's referenced, rather than building a form that collects one to nowhere |
| Auditability | `ActivityLog` (see [`03-database-design.md`](./03-database-design.md) and `docs/SRS.md` §19) — a unified log of both customer and staff actions, viewable at `GET /admin/activity-log` (`OWNER`-only). Wired into a representative cross-section of write paths (auth, checkout, product/order/employee writes), not yet every mutation — see SRS §19 AL-FR-2 for exactly what's covered and what isn't (user/role changes and inventory adjustments have no write endpoint to log against yet) |
| Financial data isolation | The entire Financial & Accounting Management module (`/admin/finance/*`, `docs/SRS.md` §20) is `OWNER`-only — group-wide ledger/consolidation data doesn't belong to any single operational department, so it's scoped tighter than every other admin surface except `/admin/users` and `/admin/activity-log`. Every journal posting is also captured in `ActivityLog` (`JOURNAL_ENTRY_POSTED`) |
| Payment gateway signature verification | `POST /payments/flutterwave/webhook` is necessarily unauthenticated (Flutterwave can't present a ChrisPa JWT) but never trusts the request body's stated payment status alone — it checks the `verif-hash` header against `FLUTTERWAVE_SECRET_HASH`, then independently re-verifies the transaction server-to-server via Flutterwave's own API before acting on it (docs/SRS.md §21 PAY-FR-2) |
| PCI scope avoidance (payments) | Same stance as saved payment methods: ChrisPa's servers never receive a raw card number or Mobile Money PIN — Flutterwave's hosted checkout page collects it directly (docs/SRS.md §21 PAY-FR-1) |
| No third-party data sharing (ChrisPa Agent) | `POST /chat/message` (docs/SRS.md FR-7.1) is a local, keyword-matched FAQ bot (`ChatService.reply()`) — visitor messages never leave ChrisPa's own infrastructure. An earlier version of this endpoint called Anthropic's Claude API to generate replies (which *did* forward the visitor's typed message to a third party); that integration was deliberately removed and replaced with the local keyword matcher per explicit user decision (no external service, no credentials, no cost), so this row is now a "doesn't apply" rather than a "scoped carefully" note. `@anthropic-ai/sdk` is no longer a dependency |

## Gaps against the template's §20 checklist

| Template item | ChrisPa state |
|---|---|
| Use HTTPS for web applications | Not applicable yet — nothing is internet-facing. **Required before any real deployment** — see [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) for the Traefik/Certbot recommendation |
| Restrict management interfaces to trusted networks or WireGuard | Not implemented — the admin console has no network-level restriction, only role-based auth. Acceptable for now (no deployment exists to restrict); revisit before the admin console is internet-facing |
| Apply least-privilege permissions | Substantially implemented (see above); the one documented exception is the local dev DB using a single non-superuser-but-shared role rather than per-purpose roles — see [`03-database-design.md`](./03-database-design.md) |
| Use MFA where supported | Available (TOTP, WebAuthn) but opt-in, not required for privileged (`OWNER`/`HR_MANAGER`) roles specifically |
| Patch operating systems, containers, libraries, applications regularly | No process exists yet — no scheduled dependency-update review. See [`14-maintenance-and-upgrade-procedures.md`](./14-maintenance-and-upgrade-procedures.md) for the recommended cadence |
| Rotate credentials and revoke inactive accounts | Refresh-token revocation works (logout, and implicitly via rotation); there is no scheduled review of dormant staff accounts |
| Back up secrets securely and separately from application source code | Secrets exist only as local `.env` files with no backup at all today — same gap as data backups, see [`15-disaster-recovery.md`](./15-disaster-recovery.md) |

## Frontend token storage — a known, accepted trade-off

Both frontend apps store JWTs in `localStorage` (see
[`05-frontend-architecture.md`](./05-frontend-architecture.md)), which is readable by any script executing on
the page — a real XSS-amplification risk. This is explicitly called out in `lib/auth-client.ts` as a dev-time
simplification. **Before any production deployment**, this should move to httpOnly, `Secure`, `SameSite`
cookies set by a server-side route handler, closing the main practical risk this document can point at with a
concrete fix.

## Recommended pre-production security checklist

Adapting the template's Final Implementation Checklist (§30) to items that are actually relevant at ChrisPa's
scale:

- [ ] Move frontend token storage from `localStorage` to httpOnly cookies
- [ ] TLS/HTTPS on any internet-facing endpoint (see [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md))
- [ ] Secrets moved out of plain `.env` into a managed secret mechanism appropriate to the chosen host
- [ ] Separate least-privilege database role for the application vs. migrations
- [ ] Dependency vulnerability scan wired into CI once CI exists (`npm audit` at minimum)
- [ ] MFA required (not just available) for `OWNER`/`HR_MANAGER` roles
- [ ] Backups exist and are encrypted at rest (see [`15-disaster-recovery.md`](./15-disaster-recovery.md))
- [ ] Real Flutterwave **live** credentials (not test/sandbox) set in production `.env`, and `FLUTTERWAVE_SECRET_HASH` configured to match the value entered in the Flutterwave dashboard's webhook settings — both are still placeholder values in this repo's `apps/api/.env`/`.env.example`
- [x] ChrisPa Agent (docs/SRS.md FR-7.1) needs no production credential — it's a local keyword-matched FAQ
      bot, not an LLM integration; the earlier `ANTHROPIC_API_KEY` requirement no longer applies (see the "No
      third-party data sharing" row above)
- [x] Rate limiting — already wired up: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` is a global
      `APP_GUARD` in `app.module.ts`, and `auth.controller.ts`/`webauthn.controller.ts` additionally apply a
      tighter `@Throttle(AUTH_THROTTLE)` on register/login/2FA endpoints specifically
