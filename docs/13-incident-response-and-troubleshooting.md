# 13. Incident Response and Troubleshooting

Adapts template §27 (Incident Management). A production environment now exists (see
[`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md)), and two
real incidents from standing it up are logged below — this document is no longer purely a procedure to have
ready, though it still describes more process (severity framing, escalation) than has actually been
exercised under real incident pressure.

## Incident management steps (template §27, unchanged — this part of the template needs no adaptation)

1. Detect and acknowledge the incident.
2. Assess impact and identify affected services.
3. Contain the problem.
4. Restore service using rollback, failover, or recovery procedures.
5. Validate service health.
6. Document root cause and corrective actions.

## Detection, today

There is no automated detection — no monitoring exists yet (see
[`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md)). Until at least basic uptime
monitoring exists, "detection" means a person noticing something is wrong, which is a real limitation to be
explicit about: **do not treat the absence of alerts as evidence of health** while this gap remains open.

## Local troubleshooting reference (today's actual environment)

| Symptom | Likely cause | Check |
|---|---|---|
| API won't start | Postgres/Redis containers not running, or wrong port | `docker ps` — confirm `5440`/`6380` are bound; `docker compose up -d` |
| `500` on most endpoints, health check fails | `DATABASE_URL` wrong, or migrations not applied | `npm run prisma:migrate`; verify `.env` matches `docker-compose.yml` credentials |
| Login works but every subsequent write 401s once, then works again | Access token expired mid-session — this is `authedFetch()`'s auto-refresh working as designed, not a bug (see [`05-frontend-architecture.md`](./05-frontend-architecture.md)) |
| A customer can't reach data that should be theirs | Check ownership-scoping logic (`findFirst({ id, userId })`) on the specific module — this pattern is deliberate and tested; a regression here is a real bug worth flagging loudly |
| Admin write silently rolls back with a `NotFoundException` immediately after a transactional create | The known `getByIdForAdmin()`/`getById()` transaction-visibility gotcha — see `CLAUDE.md`'s Catalog/HR sections; the fix is passing `tx` through, not adding a retry |
| CORS preflight fails on `PATCH`/`PUT`/`DELETE` only | Someone reverted the explicit `methods` list in `main.ts`'s `enableCors()` — Fastify's CORS plugin defaults to `GET,HEAD,POST` only |

## Production incident log

| # | Symptom | Root cause | Resolution |
|---|---|---|---|
| 1 | First `chrispa-api` deploy built successfully but failed at startup: `Error: Cannot find module '/opt/render/project/src/apps/api/dist/main.js'` | `apps/api/tsconfig.json` has no `rootDir` pinned to `src`; because `prisma.config.ts` lives alongside `src/` under `apps/api/`, `tsc` infers the build root as `apps/api` itself, so `nest build` emits to `dist/src/main.js`, not `dist/main.js` — the same wrong path `apps/api/package.json`'s `start:prod` script assumes, never caught locally since `npm run dev:api` never runs the built output | Render's start command set to `cd apps/api && node dist/src/main.js`. **Not yet fixed at the source** — `package.json#start:prod` is still wrong; see [`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md) for the proper fix (`rootDir` in `tsconfig.build.json`) |
| 2 | A customer registered on the live storefront and never received either the email or SMS verification code, leaving their account stuck unverified with no visible error | `MailService`/`SmsService` (`apps/api/src/common/notifications/`) construct their clients at startup; when their credentials are unset (true in production as first deployed), each service logs the OTP code via `Logger.warn` instead of sending it, and `AuthService.register()` didn't treat that as a failure — the account is created, the "codes sent" response is returned, and nothing was actually delivered. Confirmed by finding the real codes in Render's log stream, already expired by the time they were found | **Resolved** — `BREVO_API_KEY`/`EMAIL_FROM_*` and `AT_USERNAME`/`AT_API_KEY` are now set on the Render service and confirmed working (see #3 and #4 below for the two further issues this uncovered). Diagnostic technique for a repeat: search Render's log stream for `not configured` or `would have sent` around the affected customer's registration time to recover the (likely expired) codes and confirm the cause |
| 3 | Configuring real `SMTP_*` credentials (first a Gmail App Password, then Brevo's own SMTP relay) didn't fix incident #2 — every send instead hung for ~45s before failing with `Connection timeout`, identically regardless of provider | Render blocks all outbound SMTP traffic (ports 25, 465, 587) on free-tier web services, a platform policy since September 2025 (see [Render's changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)) — not a credentials, DNS, or IPv6 issue (an IPv4-pinning workaround was tried first and didn't help, since the port itself is blocked regardless of address family) | **Resolved** — `MailService` rewritten to call Brevo's transactional HTTP API (`api.brevo.com`, HTTPS/443, unaffected by the port block) instead of SMTP via `nodemailer`. Confirmed live: identical Brevo credentials that timed out over SMTP succeeded instantly over the HTTP API. Diagnostic technique for a repeat: any outbound-email integration on this Render service must use an HTTP API, never raw SMTP, unless the service is upgraded off the free plan |
| 4 | While incident #3 was still unresolved, a registration request returned a bare `500` instead of the graceful "codes not delivered" behavior from incident #2, leaving an orphaned unverified account | `AuthService.register()` dispatched both OTP channels via `Promise.all` — fine when a provider is simply unconfigured (`OtpService` already no-ops on that), but a *real* provider error (the SMTP timeout from #3; separately, a freshly-generated Africa's Talking sandbox key briefly returning `401` before propagating) rejected the whole `Promise.all`, and nothing in the call chain caught it | **Resolved** — switched to `Promise.allSettled` with per-channel error logging in `AuthService.register()`; a delivery failure on either channel now degrades gracefully (registration still succeeds, `POST /auth/resend-otp` gives a real second chance) instead of crashing the request |
| 5 | A `netlify api createSiteBuild` deploy of the admin site (shipping the customer suspend/reactivate/delete feature) failed immediately with `"Skipped due to account credit usage exceeded"` — retrying produced the identical immediate rejection | Checked the account directly via `netlify api getAccount`: `capabilities.credits` shows `{included: 300, used: 0}` — **zero credits actually used, the full monthly allotment available** — yet the deploy was rejected anyway. This matches multiple actively-reported cases of a stuck/stale billing flag on Netlify's side, not a real usage or ChrisPa-side problem: [Production deploys blocked by "run out of credits" — 27.4/30 credits available](https://answers.netlify.com/t/production-deploys-blocked-by-run-out-of-credits-27-4-30-credits-available-free-plan/165415), [deploys blocked with Account credit usage exceeded despite credits available](https://answers.netlify.com/t/free-plan-deploys-blocked-with-account-credit-usage-exceeded-despite-credits-available/166648) | **Open** — needs Netlify support to manually clear the stuck flag on the account (not something fixable from this side via API or retry). Since credits are billed at the account level, this likely blocks the storefront site's deploys too, not just admin's. The backend half of the feature this blocked (Render API, migration, endpoints, RBAC) is fully live regardless — only the admin UI's visibility on the live site is affected |

## Recommended incident severity framing

Still not formally defined, even though production now exists — worth setting explicitly rather than
improvising under live-incident pressure:
- **SEV1**: checkout or login fully unavailable, or data integrity at risk (e.g. a transaction failure that
  could double-decrement inventory or double-pay payroll). Incidents #2–#4 above — registration OTP delivery
  being completely non-functional, then crashing outright — arguably belonged here by impact while open (no
  new customer could complete signup), even though nothing looked "down" from a health-check perspective;
  a good example of why detection can't rely on uptime monitoring alone (see below).
- **SEV2**: a single non-critical module degraded (e.g. CMS writes failing) with a workaround available.
- **SEV3**: cosmetic or low-traffic-path issue.

Assign an owner and expected response time per severity when this is formalized — deferred here since
setting SLAs without an on-call rotation to hold them would be aspirational rather than real.

## Escalation

No on-call rotation or escalation path exists — the project currently has a small, known set of staff
accounts (see seed data in [`03-database-design.md`](./03-database-design.md)); incident response today means
contacting the project owner directly. Formalize this once the team or user base grows past what direct
contact can handle.
