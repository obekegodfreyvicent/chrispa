# 14. Maintenance and Upgrade Procedures

Adapts template §24 (Operational Checklists).

## Current state

No recurring maintenance process exists yet — appropriate for a project with no production deployment, but
worth establishing habits now so they're already routine once one exists.

## Dependency and platform upgrades

- **Node.js**: no LTS version is currently pinned (`engines`/`.nvmrc` missing — see
  [`04-backend-development.md`](./04-backend-development.md)). Add this before it matters, i.e. before a
  second developer or a CI runner needs to match a version implicitly.
- **npm packages**: `package-lock.json` pins exact versions; no scheduled `npm outdated`/`npm audit` review
  exists. Given the newly-flagged-package approval gate already in place
  (`npm approve-scripts`), reviewing and approving updates deliberately (rather than blanket
  `npm update`) is already the natural workflow — just not yet done on a cadence.
- **Prisma / PostgreSQL**: schema changes go through `prisma migrate dev` and are committed; there is no
  process yet for reviewing Postgres major-version upgrades (currently pinned to `postgres:16-alpine` in
  `docker-compose.yml`).
- **Next.js 16**: both frontend apps are pinned to the same version; upgrading one without the other would
  reintroduce drift in the shared-but-duplicated design tokens/auth pattern (see
  [`05-frontend-architecture.md`](./05-frontend-architecture.md)) — upgrade both together.

## Recommended checklists (adapted from template §24, trimmed to what's operable today)

**Weekly (applicable now, even in local dev)**
- [ ] Review `npm outdated` across all three workspaces for security-relevant updates.
- [ ] Confirm `npm run test --workspace apps/api` still passes on `main`.
- [ ] Grep `follow-up work` in `apps/api/src` to check whether any previously-deferred item has become
      relevant to current work (this is the project's own convention for tracking intentional gaps).

**Once CI/CD exists**
- [ ] Review any failed pipelines.
- [ ] Review certificate/domain status (once anything is deployed with TLS).

**Once production exists**
- [ ] Daily: review monitoring alerts, verify backups completed, check storage capacity (see
      [`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md) and
      [`15-disaster-recovery.md`](./15-disaster-recovery.md) — both currently gate on infrastructure that
      doesn't exist yet).
- [ ] Monthly: test a representative backup restoration; review accounts/permissions (staff roles, dormant
      logins); review infrastructure capacity.

## Schema/data migration discipline

`EmployeesService.update()`'s auto-logged `EmploymentHistoryEntry` audit trail and the various
`archive-instead-of-delete`/soft-termination patterns (products with order history, employees) are the
project's existing convention for preserving history through change — any new maintenance tooling (bulk data
fixes, admin scripts) should follow the same pattern rather than hard-deleting or raw-`update()`-ing around
it, per `CLAUDE.md`.
