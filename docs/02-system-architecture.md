# 02. System Architecture

Adapts template §3 ("High-Level Architecture") to ChrisPa's actual topology.

## Current architecture (local development — the only environment that exists)

```
Browser
  │
  ├── http://localhost:3001  ──▶  apps/storefront (Next.js 16, App Router)
  ├── http://localhost:3002  ──▶  apps/admin (Next.js 16, App Router)
  │
  │   both call, from the browser, via authedFetch()
  ▼
http://localhost:3000/api/v1  ──▶  apps/api (NestJS + Fastify)
  │
  ├──▶ PostgreSQL 16  (docker-compose "postgres", host port 5440)
  ├──▶ Redis 7        (docker-compose "redis",    host port 6380)
  └──▶ apps/api/uploads/  (local disk — user-uploaded avatars, no object storage)
```

There is no reverse proxy, no DNS layer, no VPN layer, and no separate build/deploy pipeline yet: each
process runs directly (`npm run dev:api` / `dev:storefront` / `dev:admin`) against ports fixed in each app's
own dev server config, and the two Postgres/Redis containers are the only containerized pieces.

The template's assumed flows (§3) map onto ChrisPa as follows:

| Template flow | ChrisPa today |
|---|---|
| Internet / external users → DNS → Traefik → application services | Not applicable — nothing is internet-facing yet; browser talks directly to `localhost` ports |
| Administrators → WireGuard VPN → internal services | Not applicable — admin console is served on the same network as the storefront, no private network segmentation |
| Developers → GitLab → GitLab Runner → build/test → container image → deployment | Not applicable — no CI/CD; builds are run locally (`npm run build:*`) |
| Applications → PostgreSQL and persistent storage | Real today — Prisma-backed Postgres, plus local disk for uploads |
| Infrastructure → Checkmk monitoring | Not applicable — see [`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md) |
| Critical data → Borg/borgmatic encrypted backups | Not applicable — see [`15-disaster-recovery.md`](./15-disaster-recovery.md) |
| Users → Nextcloud / Zulip / iRedMail | Not applicable — ChrisPa has no self-hosted mail/chat/file-collaboration services |

## Request flow — a representative write (checkout)

1. Storefront calls `POST /api/v1/checkout` with a bearer access token (`authedFetch()`, `lib/auth-client.ts`).
2. `JwtAuthGuard` verifies the JWT signature; `MustChangePasswordGuard` (global, `APP_GUARD`) checks the
   `mustChangePassword` claim decoded from the same JWT.
3. `CheckoutService` validates the cart, checks per-warehouse stock (FIFO across batches), computes pricing
   (delivery fee + optional coupon), and — inside a single Prisma `$transaction` — creates the `Order` and its
   `OrderItem`s, decrements `InventoryRecord`, awards loyalty points, and clears the cart.
4. Response returns the created order; the storefront redirects to an order-confirmation view.

This end-to-end path (validation → guarded controller → transactional service → Postgres) is the pattern
every other module (`catalog`, `orders`, `hr/payroll`, …) follows; see
[`04-backend-development.md`](./04-backend-development.md) for the module layout and
[`06-api-design-and-documentation.md`](./06-api-design-and-documentation.md) for the API surface.

## Logical layers (present-day)

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   apps/storefront (Next.js)  │     │    apps/admin (Next.js)      │
│   (site)/(auth) route groups │     │    (admin) route group       │
└──────────────┬────────────────┘     └──────────────┬────────────────┘
               │  JSON over HTTP, JWT bearer token, CORS-restricted
               ▼
┌───────────────────────────────────────────────────────────────────┐
│                     apps/api (NestJS + Fastify)                     │
│  auth · catalog · cart · checkout · orders · inventory · crm ·      │
│  marketing · cms · loyalty · support · admin-users · wishlist ·     │
│  addresses · payment-methods · profile · account-settings ·         │
│  account-notifications · chat · finance · marketplace · payments ·  │
│  health · hr                                                        │
│  JwtAuthGuard · RolesGuard(@Roles) · MustChangePasswordGuard(APP_GUARD) │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ Prisma Client
                                    ▼
                    ┌───────────────────────────────┐
                    │  PostgreSQL 16 (schema.prisma)  │
                    └───────────────────────────────┘
                    ┌───────────────────────────────┐
                    │  Redis 7 (provisioned, not yet  │
                    │  wired into application code)   │
                    └───────────────────────────────┘
```

Redis is running in `docker-compose.yml` and referenced in `.env.example` (`REDIS_URL`) but no module in
`apps/api/src` currently uses it — it is provisioned ahead of need (e.g. for a future rate-limit store,
session cache, or job queue), not yet load-bearing.

## Target architecture (future — not built)

When ChrisPa moves beyond local development, the realistic target (right-sized for a small business, not the
template's full self-hosted stack) is:

```
Internet
  │
  ▼
Managed DNS + HTTPS (managed cert, e.g. platform-provided TLS or Certbot on a single edge host)
  │
  ▼
Reverse proxy / edge (a single Traefik or hosting-provider load balancer)
  │
  ├──▶ storefront (containerized Next.js)
  ├──▶ admin (containerized Next.js, ideally on a restricted hostname/IP allowlist)
  └──▶ api (containerized NestJS)
          │
          ├──▶ managed or self-hosted PostgreSQL (with automated backups)
          └──▶ managed or self-hosted Redis
```

This target does not require Ansible, WireGuard, LXC, or the template's collaboration tools (iRedMail,
Zulip, Nextcloud) at ChrisPa's current scale — see
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) for the reasoning and
what would change that recommendation (e.g. hiring a dedicated ops function, or a compliance requirement for
self-hosted email).
