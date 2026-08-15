# 00. Documentation Index

## Document control

| Field | Value |
|---|---|
| Document Set Title | ChrisPa Software Development, Deployment and Operations Documentation |
| Version | 1.0 |
| Date | 12 August 2026 |
| Format | Markdown, `docs/` |
| Status | Baseline — reflects the project's actual state as of this date; update alongside the code as it changes |
| Source template | `Software_Development_and_DevOps_Documentation_v2_Observability.docx` (generic self-hosted DevOps platform template) |

## Why this document set exists and how it should be read

This set was produced by analyzing `docs/Software_Development_and_DevOps_Documentation_v2_Observability.docx`
— a generic template for documenting a self-hosted software development and operations platform — and
restructuring ChrisPa's project documentation to follow the same headings and scope. The template assumes
infrastructure (GitLab, Ansible, WireGuard, Traefik/Certbot, LXC, iRedMail, Zulip, Pi-hole, Nextcloud,
Checkmk, Borg/borgmatic) and an observability stack (Prometheus/Grafana, Jaeger, EFK/ELK) that ChrisPa, a
small Uganda-based e-commerce business, does not run and — per the scope agreed for this documentation pass —
should not be described as if it did.

**Every document below leads with ChrisPa's actual current state**, grounded in the real code
(`apps/api`, `apps/storefront`, `apps/admin`, `docker-compose.yml`, `schema.prisma`) rather than the
template's assumptions, and only then gives a right-sized recommendation for what's missing. Gaps are marked
**Not implemented** / **Not adopted** explicitly rather than glossed over — treat every such marker as a real
punch-list item, not documentation of something that secretly exists.

This is a living document set: update it alongside the code, the same discipline `docs/SRS.md` already
follows.

**Documents 19 and 20 are a different genre**, added later at the user's request — genuine end-user manuals
(one for customers, one for staff), not adaptations of the DevOps template's sections like 01–18 are. They're
written in second person, for someone using the product day to day, not for an engineer maintaining it — if
you want to know *how the system is built*, read 01–18; if you want to know *how to actually use it*, read
19/20.

## Reading order

| # | Document | Template section(s) it adapts | Covers |
|---|---|---|---|
| — | [`SRS.md`](./SRS.md) | §4 (SRS) | Functional/non-functional requirements, data model, API surface — **pre-existing, authoritative for product requirements**; not rewritten by this pass |
| 01 | [Project Overview](./01-project-overview.md) | Project Overview | What ChrisPa is, repo shape, maturity snapshot |
| 02 | [System Architecture](./02-system-architecture.md) | §3 High-Level Architecture | Real request flow, current vs. target topology |
| 03 | [Database Design](./03-database-design.md) | §9 PostgreSQL | Schema conventions, migrations, seed data, model inventory |
| 04 | [Backend Development](./04-backend-development.md) | §8 Node.js | NestJS/Fastify conventions, module layout, logging/error-handling state |
| 05 | [Frontend Architecture](./05-frontend-architecture.md) | Frontend/Application Architecture | Next.js 16 route structure, auth pattern, shared tokens |
| 06 | [API Design and Documentation](./06-api-design-and-documentation.md) | API Design and Documentation | Route surface by module, RBAC summary, gap: no OpenAPI spec yet |
| 07 | [Authentication and Authorization](./07-authentication-and-authorization.md) | Authentication and Authorization | JWT, registration OTP (email+SMS), Google sign-in, 2FA/TOTP, WebAuthn, RBAC, forced password reset, department permissions |
| 08 | [Source Code Management and CI/CD](./08-source-code-management-and-cicd.md) | §6 GitLab, §7 CI/CD | Current state (no remote/CI), recommended pipeline once one exists |
| 09 | [Containerization and Environments](./09-containerization-and-environments.md) | §10 Docker, §21 Environments | `docker-compose.yml` reality, dev/staging/prod strategy |
| 10 | [Security Architecture](./10-security-architecture.md) | §20 Security Architecture | What's real, gaps against the template checklist |
| 11 | [Deployment and Configuration Management](./11-deployment-and-configuration-management.md) | §22 Deployment, §23 Rollback | Local "deployment" today, recommended procedure |
| 12 | [Observability and Monitoring](./12-observability-and-monitoring.md) | §18 Checkmk, §31 Observability | Metrics/traces/logs gap, sequenced adoption plan |
| 13 | [Incident Response and Troubleshooting](./13-incident-response-and-troubleshooting.md) | §27 Incident Management | Steps, local troubleshooting reference |
| 14 | [Maintenance and Upgrade Procedures](./14-maintenance-and-upgrade-procedures.md) | §24 Operational Checklists | Dependency/platform upgrade practice |
| 15 | [Disaster Recovery](./15-disaster-recovery.md) | §19 Backup/DR, §28 DR Priorities | No-backups gap, recommended `pg_dump` approach, priority order |
| 16 | [User and Administrator Procedures](./16-user-and-administrator-procedures.md) | User and Administrator Procedures | Practical runbook: setup, access grants, common admin ops |
| 17 | [Infrastructure Platform Roadmap](./17-infrastructure-platform-roadmap.md) | §12–17 (Ansible, WireGuard, Traefik, LXC, iRedMail, Zulip, Pi-hole, Nextcloud, Checkmk, Borg) | Tool-by-tool: not adopted, why, and the trigger to revisit |
| 18 | [Appendices](./18-appendices.md) | Appendices | Command reference, directory structure, env vars, consolidated checklist |
| 19 | [Storefront User Manual](./19-storefront-user-manual.md) | — (not a template section; a genuine end-user guide) | How a customer actually uses the storefront — accounts, browsing/filters, cart/checkout, orders/receipts, account settings, getting help |
| 20 | [Administrator User Manual](./20-admin-user-manual.md) | — (not a template section; a genuine end-user guide) | How staff actually use the admin console, organized by role — every section from Product Manager through Financial & Accounting |
| 21 | [Data Flow Diagram](./21-data-flow-diagram.md) | — (not a template section; a supplementary technical artifact) | Level 0 context diagram + Level 1 diagrams for registration/OTP, login (incl. the suspend/delete gate), checkout, inventory, admin customer management, payroll — ASCII, not Mermaid (see the doc's own note on why) |
| 22 | [Entity Relationship Diagram](./22-entity-relationship-diagram.md) | — (not a template section; a supplementary technical artifact) | Every FK relationship as one table row, plus small per-domain ASCII ER diagrams — complements [`03`](./03-database-design.md)'s narrative overview with the field/relationship detail it doesn't carry |
| 23 | [Data Dictionary](./23-data-dictionary.md) | — (not a template section; a supplementary technical artifact) | Full field-by-field reference for every model (~60) and enum (~35) in `schema.prisma` |

All three (21–23) carry their own "generated against commit `X`" freshness note — they're point-in-time
artifacts, not auto-synced to the live schema; re-generate by hand after a schema change rather than trusting
them blindly during a stale-looking review.

## Cross-cutting themes (appear in multiple documents — read once, applies everywhere)

- **Production exists now** — `api` (Render), `storefront`, and `admin` (both Netlify) are live and
  auto-deploy on push to `main`; see [`11`](./11-deployment-and-configuration-management.md) for URLs and
  config, [`02`](./02-system-architecture.md) for the topology. No **staging** environment exists yet, and
  no CI pipeline gates the auto-deploy — those two gaps, plus monitoring/backups, are what the remaining
  "not implemented" markers throughout this doc set actually refer to now, not the absence of production
  itself. Two real production issues are open: registration OTP delivery is non-functional (no SMTP/SMS
  provider configured — see [`07`](./07-authentication-and-authorization.md) and
  [`13`](./13-incident-response-and-troubleshooting.md)), and the free-tier Postgres instance expires 90 days
  after creation unless upgraded (see [`11`](./11-deployment-and-configuration-management.md)).
- **The `tx`-passthrough transaction pattern** (`CatalogService.getByIdForAdmin()`, `EmployeesService.getById()`)
  is a real, previously-hit bug class — see [`04`](./04-backend-development.md) and `CLAUDE.md`.
- **Ownership-scoped self-service** (wishlist, addresses, payment methods, HR self-service) is a consistently
  applied, verified pattern — see [`07`](./07-authentication-and-authorization.md).
- **Unified activity/audit log** (`ActivityLog`, `docs/SRS.md` §19) covers both customer and staff actions —
  logins, checkout, product/order/employee writes — viewable Owner-only at Admin/Backend → Activity Log. Each
  row resolves the actor's full name and HR department at read time (AL-FR-5). Wired into a representative
  cross-section of write paths, not every mutation; see
  [`03`](./03-database-design.md), [`06`](./06-api-design-and-documentation.md),
  [`10`](./10-security-architecture.md), and [`16`](./16-user-and-administrator-procedures.md).
- **Multi-entity Financial & Accounting Management** (`docs/SRS.md` §20) — its own top-level admin console nav
  section (alongside Admin/Backend, Human Resources, and My HR, not nested inside any of them) — a real
  double-entry ledger across ChrisPa's corporate group (parent + subsidiaries), with consolidated Balance
  Sheet/Income Statement/Cash
  Flow reporting and intercompany automation (management-fee allocation, due-to/due-from tracking,
  eliminations). Owner-only, financial software with real consequences — see the module header comment in
  `apps/api/src/modules/finance` and `docs/SRS.md` §20 for exactly what's simplified vs. real.
- **Marketplace, Payments & Tax** (`docs/SRS.md` §21) — ChrisPa is a confirmed multi-vendor marketplace:
  vendor commission splits (net/agent method), a real Flutterwave gateway integration (not exercised against
  a live sandbox in this session — no real credentials were provided), Uganda VAT (18%, single-jurisdiction
  by confirmed scope), and accrual-basis revenue recognition auto-posted from checkout/order-delivery/payment
  events into the Finance ledger built in §20. Verified live against the running API, including catching and
  fixing a real bug (a zero-amount ledger line for an all-vendor-items order) during this build — see §21.6.
- **ChrisPa Agent** (`docs/SRS.md` FR-7.1) — the storefront Support page's Live Chat is now real
  (`POST /chat/message`, public), not the previous static "coming soon" placeholder, and appears as an
  avatar-and-name persona ("ChrisPa Agent", styled after the site header's logo mark) rather than the
  wireframe's original "Pa" placeholder name. Built twice: an initial Claude-API-backed version, then
  deliberately replaced with a **basic, keyword-matched FAQ bot** — no LLM, no external API, no credentials,
  no cost — per explicit user decision to trade conversational range for zero setup/ongoing cost. Still
  general help/FAQ only, still no access to customer/order/account data, still no conversation persistence.
- **Support Ticket review & response** (`docs/SRS.md` FR-7.4) — staff (`Owner`/`Store Manager`/`Support
  Agent`) can now see and respond to customer support tickets at Admin → **Support Tickets**, not just receive
  the FR-7.3 submission with nowhere for it to go. A real threaded conversation (`TicketMessage`, either side
  can post), not a single overwritable response field — the first staff reply to an `OPEN` ticket
  auto-advances it to `IN_PROGRESS`, and a `CLOSED` ticket is a hard stop for new messages from either side.
  First real use of the `SUPPORT_AGENT` role, which existed in `UserRole` from the start with no endpoint
  gated to it until now — see [`03`](./03-database-design.md), [`06`](./06-api-design-and-documentation.md),
  [`07`](./07-authentication-and-authorization.md), and [`16`](./16-user-and-administrator-procedures.md).
- **Customer receipt confirmation** (`docs/SRS.md` PAY-FR-5, §21.5) — the printable receipt (FR-6.5) now
  requires the customer's own "mutual consent," not just staff marking an order `DELIVERED`: a new
  `Order.deliveryConfirmedAt` field, set only by the customer via a new `PATCH /orders/:id/confirm-receipt`
  endpoint (the customer-facing `OrdersController`'s first write path — previously `GET`-only). Both apps'
  receipt views now carry ChrisPa's logo (the existing inline "C" mark, no new image asset), a company contact
  block (invented, clearly-placeholder details — no real one exists anywhere in this codebase), and, once
  confirmed, a CSS-drawn "received in good condition" stamp — see
  [`03`](./03-database-design.md), [`06`](./06-api-design-and-documentation.md), and
  [`16`](./16-user-and-administrator-procedures.md).
- **Storefront and Admin User Manuals** ([`19`](./19-storefront-user-manual.md), [`20`](./20-admin-user-manual.md))
  — genuine end-user documentation, added at explicit user request and distinct from the rest of this set (see
  the note above). Each ends with a "Feature Availability at a Glance" table consolidating every "not yet
  built" caveat in one place, so the rest of the manual can stay focused on describing what actually works
  today, in plain second-person instructions, without hedging every paragraph.
- **CMS admin writes — Social Media Accounts, Pages, Banners** (`docs/SRS.md` FR-19.2/FR-1.6/FR-27.1), added
  per explicit user request in two passes. Social Media Accounts came first: the storefront footer and
  Account → Connected & Social each used to hardcode their own inconsistent list of non-clickable platform
  labels; both now read one live table (`SocialMediaAccount`, `GET /cms/social-links`, public) that
  Owner/Store Manager add, edit, hide, or delete from Admin → CMS / Site Builder. That was extended to
  **Published Pages** (full CRUD, live at the storefront route `/pages/[slug]` the moment one's marked
  Published — a route that didn't exist before this) and **Active Banners** (full CRUD, image upload reusing
  the existing product-photo upload endpoint rather than a new one) — the storefront homepage hero, previously
  a static placeholder image with nothing behind it, now renders the lowest-`sortOrder` active banner. `Blog
  Posts` is the one CMS-domain model left read-only. `SocialMediaAccount.platform` is free text, not an enum,
  so any platform can be added without a schema change — see [`03`](./03-database-design.md),
  [`06`](./06-api-design-and-documentation.md), and [`16`](./16-user-and-administrator-procedures.md).
- **Admin-triggered customer suspend/reactivate/delete** (net-new scope, not in the original SRS, added per
  explicit user request) — `OWNER`/`STORE_MANAGER` can now suspend a customer account (reversible, with a
  logged reason), reactivate it, or permanently delete it from the Customers (CRM) admin page.
  `AuthService.completeLogin()` is the single enforcement point every login path (password, 2FA, Google,
  WebAuthn) already funnels through; suspending also revokes every active refresh token immediately rather
  than waiting out the current access token's TTL. See [`07`](./07-authentication-and-authorization.md),
  [`21`](./21-data-flow-diagram.md)'s Admin Customer Management diagram, and
  [`22`](./22-entity-relationship-diagram.md) for `User.suspendedAt`/`deletedAt`'s exact semantics.
- **Netlify "Account credit usage exceeded" platform bug** — confirmed account-wide (blocks both admin and
  storefront deploys), despite the account's own API showing `{included: 300, used: 0}` (zero credits
  actually used, full monthly allotment available). A documented, actively-reported Netlify-side bug, not a
  ChrisPa issue — see [`13`](./13-incident-response-and-troubleshooting.md)'s incident log for the forum
  references and current status. Any fix pushed while this is open is real and correct in the repo but not
  yet visible on the live sites — check incident #5's status before assuming a shipped fix is actually live.
- **Checkout redirect bug (fixed in code, not yet live — see above)** — `POST /checkout` returns
  `{ order, checkoutUrl }`; the post-submit redirect read `body.id` instead of `body.order.id`, sending
  customers to `/orders/undefined` and a false "Order not found" after every successful Cash-on-Delivery
  order. The order itself was always placed correctly — see
  [`13`](./13-incident-response-and-troubleshooting.md) incident #6.
- **Three near-term priorities** stand out across this whole set as worth doing before the rest: push the
  repo to a remote, add database backups, and wire forgot-password/login-alert/staff-temp-password delivery
  to the email+SMS services (registration OTP already uses real Brevo (HTTP API, not SMTP — see
  [`07`](./07-authentication-and-authorization.md) for why) + Africa's Talking delivery — the remaining work
  is integrating those same services into the other three features). See
  [`18` Appendices, section E](./18-appendices.md#e-consolidated-checklists) for the full pre-production
  checklist.
