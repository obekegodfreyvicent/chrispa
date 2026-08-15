# 09. Containerization and Environment Strategy

Adapts template §10 (Docker/Docker Compose) and §21 (Environment Strategy).

## Current state

`docker-compose.yml` (repo root) containerizes **only the two stateful dependencies** for local development:

```yaml
services:
  postgres:   # postgres:16-alpine, host port 5440
  redis:      # redis:7-alpine,    host port 6380
```

Non-default ports are intentional — this dev machine already runs other projects' Postgres/Redis on the
standard 5432/6379 (and the 5434-5439 range for Postgres). **Always check `docker ps` before assuming default
ports are free on a new machine.**

**None of the three applications (`api`, `storefront`, `admin`) are containerized** — no `Dockerfile` exists
anywhere in the repo. Locally they run as local Node processes (`npm run dev:api`, etc.); in production
(see below) they run as **platform-native builds** on Render and Netlify, which build directly from the git
source using their own Node buildpacks — neither platform required a `Dockerfile` to reach production, so
containerizing the apps remains genuinely undone work, not a blocker that was quietly worked around.

## Template compliance, mapped to what exists

| Template guidance (§10) | ChrisPa today |
|---|---|
| Build images from minimal, maintained base images | Satisfied for `postgres`/`redis` (official `-alpine` images); N/A for apps — no app images exist |
| Run containers as non-root where supported | Not verified for `postgres`/`redis` (default images); N/A for apps |
| Use named volumes for persistent data | Satisfied — `postgres_data`, `redis_data` named volumes |
| Define health checks for critical services | Not implemented — `docker-compose.yml` has no `healthcheck:` blocks yet |
| Keep secrets out of images and source repos | Satisfied — DB credentials are dev-only placeholders (`chrispa`/`chrispa`), not production secrets; real secrets live in gitignored `.env` |
| Pin image versions for production rather than floating tags | Partially — `postgres:16-alpine` and `redis:7-alpine` are major-version pinned, not exact-digest pinned |

## Recommended next step (when containerizing the apps)

Each app would need its own multi-stage `Dockerfile` (build stage with full `node_modules` + TypeScript
compile, slim runtime stage copying only `dist/`/`.next/` + production `node_modules`) and an addition to
`docker-compose.yml` (or a separate `docker-compose.prod.yml`) wiring `api`, `storefront`, and `admin` as
services alongside `postgres`/`redis`, with `depends_on` + `healthcheck` so `api` doesn't start accepting
traffic before Postgres is ready. This is meaningful, undone work — not attempted here, since it's better
scoped as its own implementation task once a hosting target is chosen (see
[`08-source-code-management-and-cicd.md`](./08-source-code-management-and-cicd.md)).

## Environment strategy

| Environment | Purpose | Typical access | Deployment | Status |
|---|---|---|---|---|
| Development | Active coding and local testing | Developers | Manual (`npm run dev:*`) + local Postgres/Redis via Compose | Exists |
| Staging | Release validation | Developers/QA | Would be CI/CD-driven once a pipeline exists | Not implemented |
| Production | Live services | Real customers and staff | Auto-deploy on push to `main` — Render (`api`) + Netlify (`storefront`, `admin`), no CI gate in front of it | **Exists — live** (see [`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md) for URLs and config) |

Production went straight from "not implemented" to live with no staging step in between — there is no
intermediate environment to validate a release against before it reaches real users. Closing that gap (a
staging Render/Netlify environment, or at minimum a CI workflow that runs tests before the existing
auto-deploy fires) is more valuable next work than containerizing the apps, since it addresses an actual
live-traffic risk rather than a theoretical one.

Config separation between environments is handled the same way in all three (env vars via `.env` /
`@nestjs/config` locally, platform environment settings in production — see
[`04-backend-development.md`](./04-backend-development.md)) — no environment-specific code branching exists
or should be added; the same build runs in every environment with only its configuration changing, which
held true end-to-end when production was stood up (no code changes were needed to make the app "prod-ready,"
only configuration).
