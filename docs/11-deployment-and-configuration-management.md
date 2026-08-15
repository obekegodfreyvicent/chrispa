# 11. Deployment Procedures and Configuration Management

Adapts template §22 (Deployment Procedure) and the configuration-management requirement.

## Local development

"Deployment" locally means a developer running the app on their own machine:

```
npm install
docker compose up -d
cp apps/api/.env.example apps/api/.env      # then fill in real values
npm run prisma:migrate
npm run db:seed
npm run dev:api          # http://localhost:3000/api/v1
npm run dev:storefront   # http://localhost:3001
npm run dev:admin        # http://localhost:3002
```

## Production deployment (live)

A production environment now exists — no staging environment yet, so `main` deploys straight to production
on every push. There is no CI test/lint gate in front of this (see
[`08-source-code-management-and-cicd.md`](./08-source-code-management-and-cicd.md)); each platform's own
build (`npm run build`) is the only check a push has to pass.

| App | Platform | Live URL | Deploys from |
|---|---|---|---|
| `api` | Render (free-plan Web Service, region `oregon`) | `https://chrispa-api.onrender.com/api/v1` | `main`, auto-deploy on push |
| `storefront` | Netlify | `https://chrispa-storefront.netlify.app` | `main`, auto-deploy on push |
| `admin` | Netlify | `https://chrispa.netlify.app` | `main`, auto-deploy on push |

Data stores, both Render free-plan, region `oregon`:

- **Postgres** (`chrispa-postgres`) — **free-plan Postgres instances expire 90 days after creation** unless
  upgraded to a paid plan; this is a hard Render platform limit, not a ChrisPa configuration choice. Track the
  creation date and either upgrade or plan a dump/restore to a fresh instance before day 90.
- **Key Value / Redis** (`chrispa-redis`) — free plan, no expiry, but capacity-limited; still not
  load-bearing in application code (see [`02-system-architecture.md`](./02-system-architecture.md)).

**API build and start commands** (set on the Render service, not derivable from `render.yaml` alone since
`render.yaml` was never actually applied as a Blueprint — the service was created directly via Render's API):

```
build: npm install && npm run prisma:generate --workspace apps/api && npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npm run build --workspace apps/api
start: cd apps/api && node dist/src/main.js
```

**Known gotcha — `dist/src/main.js`, not `dist/main.js`**: `apps/api/tsconfig.json` has no `rootDir` pinned to
`src`. Because `apps/api/prisma.config.ts` also lives directly under `apps/api/` (outside `src/`), `tsc`
infers the build's common-ancestor root as `apps/api` itself, so `nest build` emits to `dist/src/main.js` and
`dist/prisma.config.js`, not `dist/main.js`. The Render start command above already accounts for this, but
**`apps/api/package.json`'s own `start:prod` script (`"node dist/main"`) is still wrong** — it was never
caught locally because `npm run dev:api` always runs `nest start`/ts-node, never the built output. Fix the
root cause (add `"rootDir": "./src"` to `tsconfig.build.json`, or move `prisma.config.ts` under `src/`) rather
than just trusting the Render override if this gets touched again.

**Environment variables actually set on the Render `chrispa-api` service**:

| Variable | Value / source |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Internal connection strings from `chrispa-postgres`/`chrispa-redis` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_MFA_CHALLENGE_SECRET`, `TOTP_ENCRYPTION_KEY` | Randomly generated, unique to this environment |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL_DAYS` | `30` |
| `CORS_ORIGINS` | `https://chrispa-storefront.netlify.app,https://chrispa.netlify.app` |
| `PORT` | `3000` |
| `NODE_VERSION` | `22` |
| `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Brevo transactional email — HTTP API, **not SMTP** (see gotcha below) |
| `AT_USERNAME`, `AT_API_KEY` | Africa's Talking, sandbox environment |

The application code treats all five of the above as optional (falls back to logging instead of throwing —
see [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)), but that
"optional" is misleading in production: without them, registration silently creates accounts nobody can
verify. Both are now set and confirmed working end-to-end (a real registration completes in ~8s with both
codes delivered) — treat them as required for any environment meant to actually onboard customers, not
optional.

**Known gotcha — Render free-tier web services block outbound SMTP entirely**: ports 25, 465, and 587 are
blocked for all free-plan web services, a Render platform policy since September 2025 (see
[Render's changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)),
not something ChrisPa's code or config can work around. This is why `MailService` calls Brevo's HTTP API
(`api.brevo.com`, HTTPS/443) instead of using SMTP via `nodemailer` as it originally did — confirmed live
that identical credentials failed identically (~45s "Connection timeout") against both a Gmail App Password
and Brevo's own SMTP relay, and worked instantly once switched to Brevo's REST API. **If this service is ever
upgraded off the free plan, or a future integration needs outbound SMTP for some other reason, this
constraint goes away** — but don't reach for raw SMTP again on the free plan without re-confirming that.

**Frontend build-time config**: both `apps/storefront` and `apps/admin` have `NEXT_PUBLIC_API_URL` set to
`https://chrispa-api.onrender.com/api/v1` in their Netlify site settings (production context). This is
inlined into the JS bundle at build time — changing it requires a rebuild, not just a redeploy, which Netlify
does automatically on every push already, so this only matters if the API's URL ever changes.

**One-off maintenance tasks against production** (e.g. the initial `db:seed` run, or the one-off TOTP-secret
bootstrap described in [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)):
Render's **free plan does not support one-off Jobs** (`POST /services/:id/jobs` returns "new paid services
not allowed"), and a developer machine generally cannot reach the external Postgres port directly either
(sandboxed/corporate networks often reset raw Postgres/TLS traffic on non-HTTP(S) ports even when the
database itself has no IP allow-list restriction). The workaround used so far: temporarily fold the one-off
command into the build command (which runs inside Render's network, so it reaches the internal DB URL
without issue), trigger one deploy, capture the result from the build logs, then revert the build command
back to normal. This is a deliberate, temporary pattern for infrequent maintenance — not something to leave
in place, and not a substitute for upgrading to a paid plan if one-off Jobs become a frequent need.

## Recommended procedure once a staging environment and CI exist

Adapting the template's numbered §22 procedure to this stack:

1. Confirm requirements and release scope.
2. Merge approved changes into `main` through a reviewed pull/merge request.
3. CI runs lint, unit tests, and `test:e2e` (see [`08-source-code-management-and-cicd.md`](./08-source-code-management-and-cicd.md)).
4. CI builds and tags a versioned artifact (container images for `api`, `storefront`, `admin`, once those
   exist — see [`09-containerization-and-environments.md`](./09-containerization-and-environments.md)).
5. Deploy the artifact to staging.
6. Run smoke tests against staging: `GET /api/v1/health`, a login, a read-only catalog fetch, a checkout in
   `CASH_ON_DELIVERY` mode.
7. Obtain explicit production approval (a manual gate, per the template's "approval" pipeline stage).
8. Deploy to production.
9. Verify: API health endpoint, database connectivity (already covered by the health check), reverse
   proxy/DNS resolution, and — once observability exists — that metrics/logs are flowing (see
   [`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md)).
10. Record the release version and any operational notes.

Database migrations run as their own step immediately before the new application version starts serving
traffic (`prisma migrate deploy` against the target environment's `DATABASE_URL` — note this is the
non-interactive counterpart to the `migrate dev` used locally).

## Rollback

No rollback has ever been exercised in production yet. Because Render/Netlify auto-deploy on every push to
`main` with no staging gate in front of it, the practical rollback today is `git revert` (or pushing a fix
commit) to `main`, which triggers a fresh auto-deploy — there is no "redeploy the previous build" button
being relied on instead. The template's rollback guidance (§23) is directly applicable once a rollback is
actually exercised: on unacceptable impact, stop further rollout, preserve
logs and deployment metadata, restore the previous known-good artifact, and run any required database
rollback or forward-fix migration. Because `CheckoutService`, `OrdersService`'s status-transition logic, and
the payroll `run()`/`finalize()` split are all built around Prisma `$transaction`s specifically to keep
partial writes from landing, a rollback's biggest real risk is a schema migration that isn't backward
compatible with the *previous* application version — expand/contract migration pattern (add nullable columns
first, backfill, only then make them required in a later release) should be adopted once there's a
production database whose downtime/rollback cost matters.

## Configuration management

- All three apps read configuration from environment variables — `apps/api` via `@nestjs/config`
  (`.env` + `.env.example`), the frontend apps via Next.js's built-in `.env.local` support and
  `NEXT_PUBLIC_*` (inlined into the browser bundle at build time). `apps/storefront/.env.example` is the
  first frontend env file in the repo: `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:3000/api/v1` if
  unset — **in production this is set explicitly** to `https://chrispa-api.onrender.com/api/v1` in Netlify's
  site settings, since the localhost fallback is meaningless from a real visitor's browser) and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional — must match the API's `GOOGLE_CLIENT_ID`, see
  [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md); `GoogleSignInButton`
  just renders nothing if it's unset, so this one is genuinely optional, not a silent breakage). `apps/admin`
  needs the same `NEXT_PUBLIC_API_URL`, also set in Netlify; no other build-time env var of its own.
- No environment-specific code paths exist; the same build artifact should run in every environment, with
  only injected config differing — this holds true in production today (Render/Netlify inject the same shape
  of config local dev reads from `.env`, nothing is branched on an environment name).
- Not every "optional, falls back gracefully" env var is actually optional in practice — `BREVO_API_KEY`/
  `AT_*` above is the concrete example: the code's graceful degradation (log instead of throw) is a
  reasonable choice for a fresh local checkout with no delivery provider, but the same fallback silently
  broke a real feature (registration OTP) when it was still unset in production. Read a config value's
  "optional" framing as "optional for the app to boot," not "optional for the feature to work," before
  deciding it's safe to leave unset in a live environment.
- No configuration-drift detection exists (nothing like Ansible to compare desired vs. actual state) — not
  needed yet with a single environment; see
  [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) for when Ansible would
  earn its place.
