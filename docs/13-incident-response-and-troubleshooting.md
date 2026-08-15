# 13. Incident Response and Troubleshooting

Adapts template §27 (Incident Management). No incident has ever occurred against this project (there is no
deployed environment), so this document is a procedure to have ready, not a record of practice.

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

## Recommended incident severity framing (once production exists)

Not yet defined — worth setting before go-live rather than during a live incident:
- **SEV1**: checkout or login fully unavailable, or data integrity at risk (e.g. a transaction failure that
  could double-decrement inventory or double-pay payroll).
- **SEV2**: a single non-critical module degraded (e.g. CMS writes failing) with a workaround available.
- **SEV3**: cosmetic or low-traffic-path issue.

Assign an owner and expected response time per severity when this is formalized — deferred here since
setting SLAs without a production environment or on-call rotation to hold them would be aspirational rather
than real.

## Escalation

No on-call rotation or escalation path exists — the project currently has a small, known set of staff
accounts (see seed data in [`03-database-design.md`](./03-database-design.md)); incident response today means
contacting the project owner directly. Formalize this once the team or user base grows past what direct
contact can handle.
