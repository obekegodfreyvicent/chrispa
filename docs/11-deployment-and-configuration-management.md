# 11. Deployment Procedures and Configuration Management

Adapts template §22 (Deployment Procedure) and the configuration-management requirement.

## Current deployment procedure

**There is no deployment procedure — no staging or production environment exists.** "Deployment" today means
a developer running the app locally:

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

## Recommended procedure once staging/production exist

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

No rollback has ever been exercised, because nothing has been deployed. The template's rollback guidance
(§23) is directly applicable once a deployment exists: on unacceptable impact, stop further rollout, preserve
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
  first frontend env file in the repo: `NEXT_PUBLIC_API_URL` (optional — falls back to
  `http://localhost:3000/api/v1`) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional — must match the API's
  `GOOGLE_CLIENT_ID`, see [`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md);
  `GoogleSignInButton` just renders nothing if it's unset, so this is genuinely optional, not a silent
  breakage). `apps/admin` still needs no build-time env var of its own.
- No environment-specific code paths exist; the same build artifact should run in every environment, with
  only injected config differing — this is already true today (dev is just "the only environment configured
  so far," not a special code branch).
- No configuration-drift detection exists (nothing like Ansible to compare desired vs. actual state) — not
  needed yet with a single environment; see
  [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) for when Ansible would
  earn its place.
