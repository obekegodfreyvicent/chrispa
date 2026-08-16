# 04. Backend Development — Node.js (NestJS)

Adapts template §8.

## Runtime and framework

- **Node.js**: no `.nvmrc`/`engines` field pins an LTS version in `apps/api/package.json` today — the
  template's "use a supported LTS Node.js release" is a practice to formalize (add an `engines.node` field
  and/or `.nvmrc`), not yet enforced.
- **Framework**: NestJS 11 on the **Fastify** adapter (`@nestjs/platform-fastify`), not the default Express
  adapter — chosen for throughput; this means Express-specific middleware/examples don't apply directly.
- **Entry point**: `apps/api/src/main.ts` — global prefix `api/v1`, global `ValidationPipe` (`whitelist:
  true, transform: true, forbidNonWhitelisted: true`), explicit CORS with all methods listed (Fastify's CORS
  plugin defaults to `GET,HEAD,POST` only, which would otherwise fail every `PATCH`/`PUT`/`DELETE`
  preflight app-wide), and local-disk static file serving for uploads (`apps/api/uploads/`, 5MB cap) — no
  object storage/CDN integration exists yet.

## Dependency management

- **Pinned via lockfile**: `package-lock.json` at the repo root (npm workspaces) — the template's "pin
  dependency versions through the package lock file" is satisfied.
- Newly-added packages with install scripts require the environment's `npm approve-scripts` gate
  (`@prisma/client`, `@prisma/engines`, `prisma`, `unrs-resolver` are currently approved) — run
  `npm approve-scripts <pkg>` then reinstall for any newly-flagged package.

## Configuration

- Configuration is separated from source via `@nestjs/config` + a `.env` file (`apps/api/.env`, gitignored;
  `apps/api/.env.example` documents the required keys: `PORT`, `DATABASE_URL`, `REDIS_URL`,
  `JWT_ACCESS_SECRET`/`JWT_ACCESS_TTL`, `JWT_REFRESH_SECRET`/`JWT_REFRESH_TTL_DAYS`,
  `JWT_MFA_CHALLENGE_SECRET`, `TOTP_ENCRYPTION_KEY`, `CORS_ORIGINS`).
- This satisfies the template's "separate application configuration from source code" and "use environment
  variables… for deployment-time configuration" — there is no managed-secret mechanism (Vault, cloud secrets
  manager) yet, appropriate for a single local environment but a gap before any shared/production deployment
  (see [`10-security-architecture.md`](./10-security-architecture.md)).

## Module layout

`apps/api/src/modules/*` — each is a self-contained Nest module (controller + service, sometimes `dto/`):

`account-notifications`, `account-settings`, `addresses`, `admin-users`, `auth`, `cart`, `catalog`, `chat`,
`checkout`, `cms`, `crm`, `delivery`, `finance`, `health`, `hr`, `inventory`, `loyalty`, `marketing`,
`marketplace`, `orders`, `payment-methods`, `payments`, `profile`, `shipping`, `support`, `wishlist`.

Most mirror the SRS's FR groups directly; `hr` is a later, separately-scoped addition (see
`docs/SRS.md` §18). `health`, `profile`, `account-settings`, and `account-notifications` are
infrastructure/account-management modules with no dedicated FR group. `finance`, `marketplace`, `payments`,
and `chat` are later additions covering multi-entity accounting, the vendor marketplace, Flutterwave
payments, and the "ChrisPa Agent" FAQ bot respectively.

## Logging

**Structured logging is not implemented.** The application currently relies on Nest's default console
logger plus ad-hoc `console.log`/`console.error` (e.g. the startup banner in `main.ts`) — there is no
JSON-structured log format, no request/correlation ID propagation, and no log shipping. This is the template
§8 requirement ("implement structured logging…") that is the largest concrete gap in this document; see
[`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md) for the recommended minimal
starting point.

## Health endpoints

`GET /api/v1/health` (`apps/api/src/modules/health/health.controller.ts`) runs `SELECT 1` against Postgres
and returns `{ status: 'ok', timestamp }` — a real liveness/readiness check, satisfying the template's
"implement… application health endpoints" for the one endpoint that exists. There is no separate
readiness-vs-liveness split and no dependency check for Redis (Redis isn't yet used by application code — see
[`02-system-architecture.md`](./02-system-architecture.md)).

## Error handling

- Nest's built-in exception filters convert thrown `HttpException` subclasses (`NotFoundException`,
  `ForbiddenException`, `BadRequestException`, etc.) into JSON error responses without leaking stack traces —
  this satisfies "avoid exposing internal stack traces to end users" for the common path.
- There is no custom global exception filter for centralized error logging/formatting beyond Nest's default —
  acceptable at current scale, worth revisiting once structured logging exists (so errors are captured with
  the same correlation metadata as everything else).

## Testing

- Unit tests: `jest`, configured per-workspace in `apps/api/package.json` (`npm run test`,
  `npm run test:cov`).
- End-to-end tests: `npm run test:e2e` (`test/jest-e2e.json`).
- **Not yet run in CI** — see [`08-source-code-management-and-cicd.md`](./08-source-code-management-and-cicd.md).

## Known partial/incomplete areas

Per `CLAUDE.md`: most modules outside `auth`, `checkout`, admin product management, and admin order
management implement only the straightforward read-side Prisma queries; business logic with real pending
design decisions is intentionally deferred. Within `auth` itself, registration OTP (email+SMS), Google
sign-in, TOTP 2FA, and WebAuthn/biometric login are all fully built — the remaining `auth` gaps are
forgot-password, Facebook/Apple social login, admin invites, and OTP-as-login-credential (as opposed to
OTP-as-registration-gate, which is done) — see
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md) for the current split.
Each gap is marked in code with a comment pointing at the relevant SRS FR-ID —
`grep "follow-up work" apps/api/src` finds all of them.
