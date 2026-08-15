# 12. Observability Architecture and Monitoring

Adapts template §18 (Checkmk) and §31 (Observability — Prometheus/Grafana, Jaeger, EFK/ELK).

## Current state

| Signal | State |
|---|---|
| Metrics | Not implemented — no `/metrics` endpoint, no Prometheus, no Grafana |
| Traces | Not implemented — no OpenTelemetry instrumentation, no Jaeger |
| Logs | Console output only (Nest's default logger + a few `console.log` calls) — not structured, not centralized, not retained beyond the terminal/process that produced them |
| Infrastructure monitoring (Checkmk or equivalent) | Not implemented |
| Uptime/health monitoring | One real check: `GET /api/v1/health` (queries Postgres with `SELECT 1`) — nothing polls it automatically today |
| Alerting | Not implemented — nothing to alert *from* yet |

This is the largest operational gap in the project relative to the template, entirely explained by there
being no deployed environment yet to observe. The template's three-pillar framing (metrics = what, traces =
where/how slow, logs = why) is the right target model — the recommendation below sequences adoption instead
of doing it all at once, since building a full Prometheus + Jaeger + EFK stack for an app with no traffic
would be pure overhead.

## Recommended adoption order (right-sized for ChrisPa, not the full template stack at once)

1. **Structured logging first.** Replace ad-hoc `console.log` with a structured JSON logger (e.g. Nest's
   built-in logger configured for JSON output, or `pino`) including timestamp, service, environment,
   severity, and a request/correlation ID. This is the cheapest signal to add and the one every later
   troubleshooting flow depends on — matches the template's §31.4 logging practices exactly:
   - Never log passwords, API keys, session tokens, or other secrets.
   - Include timestamp, service, environment, severity, request/correlation ID, error information.
   - Use structured JSON logs where practical.
2. **Basic uptime/health monitoring**, once anything is deployed: an external check hitting
   `GET /api/v1/health` on an interval, alerting on failure. This alone covers "Infrastructure and
   application health shall be monitored" (SRS-adjacent NFR from the template's §4.2) without needing a full
   monitoring platform.
3. **Metrics (Prometheus + Grafana)**, once there's a second reason to want them beyond uptime — e.g. real
   user traffic where request rate/latency/error rate start mattering, or the checkout/payment path needs an
   SLO. Expose `/metrics` from `apps/api` (NestJS has straightforward Prometheus exporter integrations);
   recommended metrics per the template §31.1: CPU/memory/disk (infra-level, from a host exporter, not the
   app), HTTP request rate/latency/error rate, PostgreSQL connections/performance, certificate expiry.
4. **Centralized logging (EFK or ELK)**, once log volume across more than one running process makes grepping
   individual containers impractical — i.e. once there's more than a single API instance, or once staging
   and production both exist and need to be searched together.
5. **Distributed tracing (Jaeger)**, last — genuinely only pays off once requests cross multiple services.
   Today, one request touches exactly one process (`apps/api`) plus Postgres; there is no multi-service
   fan-out for a trace to usefully show yet. Revisit if the architecture grows a second backend service, a
   queue worker, or a separate payment-gateway integration service.

## Correlation, once more than one pillar exists

Per the template §31.4-31.6: metrics, traces, and logs should share common service and correlation metadata,
so an operator can go from an elevated-latency alert → the relevant trace → the relevant logs. Build the
request/correlation ID into structured logging from day one (step 1 above) specifically so this correlation
is possible later without a retrofit.

## Checkmk / general infrastructure monitoring

Not adopted — see [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md). At
ChrisPa's scale, a managed-hosting provider's built-in monitoring (or a lightweight external uptime checker)
covers the same need as Checkmk without operating a self-hosted monitoring server.

## Pre-production observability checklist (from template §30, filtered to what applies)

- [ ] Structured logging emits from `apps/api` in production
- [ ] Secrets excluded from logs/metrics/traces (verify no request body containing a password/token is ever logged)
- [ ] Log retention and storage capacity are defined and monitored, wherever logs end up
- [ ] An external uptime check hits `/api/v1/health` on an interval, with an owner for its alerts
- [ ] Once Prometheus/Grafana exist: dashboards cover infrastructure, the API, PostgreSQL
- [ ] Once tracing exists: traces never contain passwords, tokens, or other sensitive information
