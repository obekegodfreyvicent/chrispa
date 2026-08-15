# 18. Appendices

## A. Command reference

```
# Install & local infra
npm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
npm run prisma:migrate
npm run db:seed

# Run
npm run dev:api          # http://localhost:3000/api/v1
npm run dev:storefront   # http://localhost:3001
npm run dev:admin        # http://localhost:3002

# Build
npm run build:api
npm run build:storefront
npm run build:admin

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
cd apps/api && npx prisma studio          # local DB browser
cd apps/api && npx prisma migrate reset   # DESTRUCTIVE — requires explicit fresh user consent

# Per-workspace (api example)
npm run lint --workspace apps/api
npm run test --workspace apps/api
npm run test:e2e --workspace apps/api
npm run test:cov --workspace apps/api

# Newly-flagged install-script packages
npm approve-scripts <pkg>
npm install
```

## B. Directory structure (actual, not the template's assumed layout)

```
ChrisPa/
├── apps/
│   ├── api/
│   │   ├── prisma/           schema.prisma, migrations/, seed.ts
│   │   ├── src/
│   │   │   ├── modules/       auth, catalog, cart, checkout, orders, inventory,
│   │   │   │                  crm, marketing, cms, loyalty, support, admin-users,
│   │   │   │                  wishlist, addresses, payment-methods, profile,
│   │   │   │                  account-settings, account-notifications, health, hr,
│   │   │   │                  chat, finance, marketplace, payments
│   │   │   ├── common/        prisma service, shared util
│   │   │   └── main.ts
│   │   └── uploads/           local disk storage for user-uploaded files
│   ├── storefront/
│   │   └── src/
│   │       ├── app/(site)/    shop, product, cart, checkout, orders, account, support,
│   │       │                  pages, search
│   │       ├── app/(auth)/    login, signup, forgot-password, reset-password
│   │       └── lib/           auth-client.ts, api.ts
│   └── admin/
│       └── src/
│           ├── app/(admin)/   products, orders, inventory, customers, marketing,
│           │                  cms, hr, my-hr, settings, activity-log, finance,
│           │                  support-tickets
│           ├── app/login, app/change-password
│           └── lib/           auth-client.ts, use-idle-logout.ts, use-refetch-on-focus.ts
├── docs/                      this documentation set + SRS.md
├── mockUps/                   original static HTML wireframes
├── docker-compose.yml         Postgres (5440) + Redis (6380), local dev only
├── package.json                npm workspaces root
└── CLAUDE.md                   engineering-agent operating notes
```

## C. Environment variable reference (`apps/api/.env.example`)

| Variable | Purpose |
|---|---|
| `PORT` | API listen port (default 3000) |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string (provisioned, not yet used by application code) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Access token signing key / lifetime (default 15m) |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL_DAYS` | Refresh token signing key / lifetime (default 30 days) |
| `JWT_MFA_CHALLENGE_SECRET` | Signs the short-lived challenge token issued between password check and 2FA code submission |
| `TOTP_ENCRYPTION_KEY` | Encrypts stored TOTP secrets at rest |
| `CORS_ORIGINS` | Comma-separated allowed origins for the two frontend apps |
| `OTP_TTL_MINUTES` | Registration OTP code lifetime (default 10) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Generic SMTP credentials for `MailService` (registration OTP emails); unset/blank falls back to logging the message instead of sending |
| `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` | Africa's Talking credentials for `SmsService` (registration OTP SMS); `AT_USERNAME="sandbox"` + a sandbox key exercises the flow without spending real airtime credit; unset falls back to logging |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID Google Sign-In ID tokens are verified against server-side (`AuthService.googleLogin()`); unset returns a clear "not configured" error rather than a crash |
| `FLUTTERWAVE_PUBLIC_KEY` / `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_SECRET_HASH` | Flutterwave hosted-checkout credentials for Mobile Money/Card payments (`payments` module) and its webhook signature verification; a placeholder value fails cleanly with an actionable `500` rather than a crash — see `06-api-design-and-documentation.md`'s payment/checkout API scope note |

### `apps/storefront/.env.example`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL; optional — falls back to `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Must match the API's `GOOGLE_CLIENT_ID` above; optional — `GoogleSignInButton` renders nothing if unset, rather than breaking |

## D. Document set index

See [`00-documentation-index.md`](./00-documentation-index.md) for the full list and reading order.

## E. Consolidated checklists

**Before any staging/production deployment** (drawn from every document above):
- [ ] Hosting platform and CI/CD chosen ([`08`](./08-source-code-management-and-cicd.md))
- [ ] App Dockerfiles + compose/orchestration wiring built ([`09`](./09-containerization-and-environments.md))
- [ ] HTTPS/TLS in place on any public endpoint ([`17`](./17-infrastructure-platform-roadmap.md))
- [ ] Frontend token storage moved off `localStorage` ([`10`](./10-security-architecture.md))
- [ ] Secrets moved out of plain `.env` ([`10`](./10-security-architecture.md))
- [ ] Structured logging shipping from `apps/api` ([`12`](./12-observability-and-monitoring.md))
- [ ] External uptime check on `/api/v1/health` ([`12`](./12-observability-and-monitoring.md))
- [ ] Database backups running and restore-tested ([`15`](./15-disaster-recovery.md))
- [ ] Repo pushed to a remote (currently local-only) ([`15`](./15-disaster-recovery.md))
- [ ] Hosted transactional email API in place of the generic SMTP endpoint (registration OTP already uses real `MailService`/`SmsService` delivery — this item is about the production-grade swap plus wiring forgot-password/login-alert/temp-password delivery to those same services) ([`17`](./17-infrastructure-platform-roadmap.md))
- [ ] Object storage chosen for user-uploaded media (replaces local disk) ([`17`](./17-infrastructure-platform-roadmap.md))

This list is the practical, ChrisPa-specific replacement for the template's generic §30 Final
Implementation Checklist — every item here is either done, or has a named document explaining exactly what's
missing and why.
