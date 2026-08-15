# 01. Project Overview

## Document Control

| Field | Value |
|---|---|
| Document Title | ChrisPa — Project Overview |
| Version | 1.0 |
| Date | 12 August 2026 |
| Status | Baseline |
| Related | [`docs/SRS.md`](./SRS.md), [`00-documentation-index.md`](./00-documentation-index.md) |

## What ChrisPa is

**ChrisPa Scents and Soaps LTD** is a Kampala, Uganda-based natural wellness e-commerce brand selling
candles, sea salts, ghee, honey, and soap bars; the parent of a multi-entity corporate group; and, since a
later addition, a **multi-vendor marketplace** — third-party sellers list products alongside ChrisPa's own.
The software project is the digital platform that runs the business: a customer-facing storefront, an
internal admin/back-office console, and (as later additions) an internal HR/payroll system for staff
management, a multi-entity Financial & Accounting Management system (`docs/SRS.md` §20) for group-wide
bookkeeping and consolidated reporting, and marketplace/payments/tax functionality (`docs/SRS.md` §21) —
vendor commission splits, a real Flutterwave gateway integration, Uganda VAT, and accrual-basis revenue
recognition wired directly into checkout and order fulfillment.

The product requirements originate from a set of static HTML wireframes (`mockUps/`) that were turned into a
formal Software Requirements Specification (`docs/SRS.md`, FR-ID by FR-ID) and then implemented as the
application in `apps/`. HR (`apps/api/src/modules/hr`) is the one major exception — it was scoped and approved
directly with the project owner in four phases, outside the original wireframes/SRS (see `docs/SRS.md` §18).

## Problem

Many commercial personal-care, home-cleaning, and culinary products contain harsh chemicals, artificial
fragrances, and toxins that can harm skin, health, and the environment. People are also looking for natural
ways to manage stress, prevent bug-borne diseases, and preserve food (vegetables, herbs, medicinal plants)
without compromising quality — access to natural, healthy, effective alternatives is limited.

## Solution

ChrisPa offers natural, organic, and therapeutic products made from locally-sourced ingredients — goat's
milk, honey, herbs, ghee, soywax, beeswax, sea salt, and essential oils — spanning personal care, home
cleaning, culinary, and wellness needs, plus specialized masterclasses and facility-care services that
educate and empower customers to adopt healthier habits and maintain clean, safe spaces.

The software platform documented here implements the **e-commerce side** of that solution end-to-end
(catalog, cart, checkout, orders, loyalty, CRM, admin back-office, HR/payroll). **Masterclasses and
facility-care services are not yet represented in the product** — no FR-IDs, data model, or UI exist for them
today; see `docs/SRS.md` §1 ("Out of scope (v1)") and §2 ("Business Context"). They're recorded here as real
business scope so a future phase can pick them up deliberately, the same way HR was added after the original
wireframes/SRS.

## Target market

1. Health-conscious individuals
2. Eco-friendly consumers
3. People seeking natural wellness solutions
4. Hotels, spas, and wellness centers
5. Middle- to upper-income households in urban areas

The current product (customer storefront + admin console) is built for direct retail sales to individual
consumers (targets 1–3, 5). Targets 4 (hotels, spas, wellness centers) implies B2B/wholesale buying patterns
— `docs/SRS.md` §2 already scopes "Wholesale/Corporate accounts (SSO-eligible)" as a customer segment
alongside Retail, so the data model has room for this; a dedicated wholesale ordering flow (bulk pricing,
purchase orders, invoicing terms) is not yet built and would be a natural next-phase candidate once demand
from that segment is confirmed.

## Why this document set exists

This documentation set (`docs/0*-*.md` through `docs/18-appendices.md`) was written against
`docs/Software_Development_and_DevOps_Documentation_v2_Observability.docx`, a generic software-development
and DevOps documentation template. That template assumes a fairly large, fully self-hosted operations
platform (GitLab + GitLab Runner, Ansible, WireGuard, Traefik/Certbot, LXC, iRedMail, Zulip, Pi-hole,
Nextcloud, Checkmk, Borg/borgmatic, plus a Prometheus/Grafana/Jaeger/EFK observability stack). ChrisPa is a
small e-commerce business, not an enterprise running that scale of infrastructure — almost none of that
tooling exists in this repository today.

Rather than inventing infrastructure that isn't there, each document below follows the template's structure
and headings but reports ChrisPa's **actual** current state first, then a right-sized recommendation.
Anything not yet built is marked **Not implemented** or **Not adopted** rather than described as if it
existed. The one document that engages with the template's specific self-hosted tool list directly is
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md). Two further documents,
[`19`](./19-storefront-user-manual.md) and [`20`](./20-admin-user-manual.md), sit outside this
template-adaptation exercise entirely — genuine end-user manuals for customers and staff, added later at
explicit user request; see [`00-documentation-index.md`](./00-documentation-index.md) for how they differ
from the rest of this set.

## System components

| Component | Path | Framework | Purpose |
|---|---|---|---|
| API | `apps/api` | NestJS 11 + Fastify | REST backend: catalog, cart, checkout, orders, inventory, CRM, marketing, CMS, loyalty, support, admin users, HR/payroll |
| Storefront | `apps/storefront` | Next.js 16 (App Router) | Customer-facing shop |
| Admin console | `apps/admin` | Next.js 16 (App Router) | Back-office console for staff (Owner, Store Manager, Fulfillment, HR Manager, Support Agent roles) |

Shared infrastructure: PostgreSQL 16 (via Prisma ORM) and Redis 7, both run locally today through the root
`docker-compose.yml`. There is no shared package between the two frontend apps — each defines its own copy of
design tokens and auth helpers, matching the wireframes' "every file is fully standalone" convention (see
`CLAUDE.md`).

## Repository shape

```
ChrisPa/
├── apps/
│   ├── api/            NestJS + Fastify backend
│   ├── storefront/     Next.js customer storefront
│   └── admin/           Next.js admin console
├── docs/                SRS + this documentation set
├── mockUps/             Original static HTML wireframes
├── docker-compose.yml   Local Postgres (5440) + Redis (6380)
├── package.json         npm workspaces root
└── CLAUDE.md            Engineering-agent operating notes
```

This is an npm workspaces monorepo (`workspaces: ["apps/*"]`), not the template's suggested
`ansible/ applications/ docker/ database/ monitoring/ backup/` layout (§25 of the template) — see
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md) for why that structure
doesn't apply yet and what would trigger adopting a version of it.

## Current maturity snapshot

| Area | State |
|---|---|
| Product functionality (storefront, admin, HR/payroll, multi-entity finance) | Extensive — see `docs/SRS.md` and `CLAUDE.md` for module-by-module detail |
| Automated tests | Tooling configured per-workspace (`jest`, `test:e2e` in `apps/api`), but no real tests written yet — zero `*.spec.ts` files exist under `apps/api/src`, and the only e2e spec is the unmodified NestJS CLI scaffold (`apps/api/test/app.e2e-spec.ts`, asserting `GET /` returns `"Hello World!"`), a route that doesn't exist in this app (global prefix is `api/v1`) — it would fail if actually run. No CI runs them either way |
| Source control hosting | Local git only — no `origin` remote configured in this environment |
| CI/CD | Not implemented |
| Containerized app deployment | Not implemented (only Postgres/Redis are containerized, for local dev) |
| Production hosting | Not implemented — no staging or production environment exists yet |
| Monitoring / observability | Not implemented beyond a single `/api/v1/health` liveness check |
| Backups | Not implemented |

Every later document in this set expands on one row of this table.
