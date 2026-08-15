# 15. Backup and Disaster Recovery

Adapts template §19 (Backup and DR) and §28 (DR Priorities).

## Current state: no backups exist

There is no scheduled backup job, no off-site copy, and no tested restore procedure for the local
PostgreSQL database. This is the single largest risk on this list precisely because seed/demo data is
disposable but **any real order, HR, or payroll data entered once ChrisPa goes live would not be** — this
gap should close before production use begins, not after.

## Why Borg/borgmatic (the template's recommendation) is oversized for now

Borg/borgmatic is built for backing up an entire self-hosted platform's worth of heterogeneous data
(application files, configs, multiple databases, mail stores) with deduplication across all of it. ChrisPa
currently has exactly one thing that needs backing up: a single PostgreSQL database. A `pg_dump`-based
approach gets the same recoverability guarantee with far less operational surface:

## Recommended starting point

```
pg_dump --format=custom --file="chrispa-$(date +%Y%m%d%H%M%S).dump" "$DATABASE_URL"
```

run on a schedule (cron, or a CI scheduled pipeline once one exists), with the resulting dump:
- encrypted before it leaves the host it was taken on,
- copied to at least one location independent of the primary database host (satisfies the template's 3-2-1
  principle's "off-site copy" leg even at minimal scale — 3 copies, 2 media, 1 off-site),
- retained on a rolling window (e.g. 7 daily + 4 weekly) rather than kept forever.

Restore is the inverse (`pg_restore`) — this should be **tested**, not just assumed to work, before it's
relied on. A monthly restore-into-a-scratch-database drill is a lightweight version of the template's
"perform scheduled restoration tests" that's realistic to actually run at this scale.

## RTO / RPO

Not yet defined — there's no business requirement to derive them from until ChrisPa is taking live orders
against this system. Placeholder framing to formalize before go-live: given a daily backup cadence, RPO
would default to "up to 24 hours of data" unless a tighter cadence (e.g. hourly, or Postgres WAL archiving
for point-in-time recovery) is adopted for the orders/payroll tables specifically, which carry real financial
consequences (see the payroll module's PAYE/NSSF accuracy requirements in `CLAUDE.md`).

## Secrets backup

Same gap as data: `.env` files exist only on the machine that created them, with no backup. Once a secrets
manager is adopted (see [`10-security-architecture.md`](./10-security-architecture.md)), its own
backup/recovery story supersedes this concern; until then, treat losing the local `.env` as equivalent to
losing all issued JWTs and the TOTP encryption key (i.e. every active session and 2FA enrollment) — worth a
manual, secure, off-machine copy the moment a real deployment's secrets are generated.

## Disaster recovery priorities (template §28, ChrisPa read-through)

The template's ordered list, checked against what ChrisPa actually has:

1. **Network access and DNS** — not applicable yet, nothing is deployed.
2. **Identity/authentication dependencies** — this *is* PostgreSQL for ChrisPa (no separate directory
   service); recovering the database recovers auth.
3. **PostgreSQL and other persistent databases** — the one component that actually needs a DR plan today.
4. **Critical application services** — `apps/api`, `apps/storefront`, `apps/admin` are stateless once the
   database is back; redeploying them is a build, not a restore.
5. **Source repositories** — currently local-only git; the recovery risk here is losing the one machine with
   the only copy of the repository, which argues for pushing to a remote (see
   [`08-source-code-management-and-cicd.md`](./08-source-code-management-and-cicd.md)) sooner rather than
   later, independent of any CI/CD motivation.
6. **Email and collaboration services** — not applicable; ChrisPa doesn't self-host these (see
   [`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md)).
7. **Monitoring and backup systems** — not applicable yet; nothing to recover before it exists.

For ChrisPa specifically, the realistic priority order collapses to: **push the repo to a remote, then stand
up database backups** — both are cheap, both close the two scenarios that would otherwise mean unrecoverable
loss of work.
