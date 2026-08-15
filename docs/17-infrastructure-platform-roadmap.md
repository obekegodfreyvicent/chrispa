# 17. Infrastructure Platform Roadmap

The Word template (`Software_Development_and_DevOps_Documentation_v2_Observability.docx`) assumes a
fully self-hosted operations platform built around ten infrastructure tools beyond the application stack
itself. **None of these are adopted in ChrisPa today**, and this document argues most of them shouldn't be —
yet — rather than pretending they exist. Each section states the template's intent, ChrisPa's current state
(consistently: not adopted), a right-sized recommendation, and the concrete trigger that would justify
revisiting the decision.

## 17.1 Infrastructure Automation — Ansible

**Template intent**: reproducible infrastructure config via idempotent playbooks, environment-specific
inventories, roles.

**Current state**: not adopted. There is nothing to configure yet — no servers exist outside this
development machine and its two local containers.

**Recommendation**: don't adopt until there's more than one server to keep consistent. A single production
host provisioned once by hand (with the setup steps documented, not automated) is not worth an Ansible
investment. **Trigger**: a second production host (e.g. separate app/DB hosts, or horizontal scaling of the
API), or infrastructure changing often enough that manual drift becomes a recurring incident cause.

## 17.2 Networking — WireGuard

**Template intent**: private encrypted network for administrative/internal service access, separate from
public traffic.

**Current state**: not adopted. No production network exists to segment.

**Recommendation**: the admin console's `RolesGuard`-based access control is the real boundary today (see
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)); a hosting provider's
firewall/security-group rules restricting the admin console's origin IPs would likely satisfy the same need
more simply than standing up WireGuard. **Trigger**: a compliance requirement for network-level (not just
application-level) admin isolation, or a dedicated ops/infra employee who'd maintain it.

## 17.3 Reverse Proxy & TLS — Traefik and Certbot

**Template intent**: ingress, routing, and automated HTTPS certificate management.

**Current state**: not adopted — nothing is internet-facing.

**Recommendation**: this is the one item on this list that becomes **required, not optional**, the moment
anything is deployed publicly — HTTPS is non-negotiable for a site handling login credentials and (even
cash-on-delivery) order/payment data. Whether that's Traefik specifically or a managed load balancer with
automatic TLS (many hosting providers offer this out of the box) is an implementation choice, not a
requirements question. **Trigger**: the first public deployment — sequence this before go-live, not after.

## 17.4 Application Hosting — LXC

**Template intent**: OS-level isolation for system workloads, lighter than full VMs.

**Current state**: not adopted.

**Recommendation**: once the apps are containerized (see
[`09-containerization-and-environments.md`](./09-containerization-and-environments.md)), Docker alone
provides sufficient isolation for three web services and a database — LXC solves a different problem (running
system-level services that predate or don't fit the container model). **Trigger**: none currently
foreseeable for ChrisPa's architecture.

## 17.5 Email Infrastructure — iRedMail

**Template intent**: self-hosted email platform with DNS/TLS/anti-abuse/reputation management.

**Current state**: iRedMail specifically — not adopted, and the recommendation below still holds. But
ChrisPa now has **working, generic email and SMS delivery**: `MailService` (SMTP via `nodemailer` — any
account works, from a Gmail app password to a real transactional-email SMTP endpoint) and `SmsService`
(Africa's Talking) are both real integrations, currently used for registration OTP (see
[`07-authentication-and-authorization.md`](./07-authentication-and-authorization.md)). Both fall back to
logging instead of sending when unconfigured — a documented dev convenience, not a placeholder. What
remains a **functional gap** is narrower than it used to be: forgot-password, login-alert delivery, and
staff temp-password delivery don't call these services yet, even though the services themselves now exist
and work — that's integration work on each of those three features, not a provider-selection blocker.

**Recommendation**: for production, swap the generic SMTP endpoint for a real transactional email API (e.g.
a hosted provider) rather than a self-hosted mail server — self-hosted email requires ongoing
reputation/deliverability management that has nothing to do with ChrisPa's product and everything to do with
becoming an email-infrastructure operator. Wiring forgot-password/login-alerts/temp-password delivery to the
already-real `MailService`/`SmsService` is the more urgent near-term item now, independent of that swap.

## 17.6 Team Communication — Zulip / Slack

**Template intent**: internal team chat.

**Current state**: not adopted by the software platform (the business may use WhatsApp/Slack/email
informally — that's outside this codebase's scope either way).

**Recommendation**: not a software-project concern; whatever the ChrisPa team already uses for internal
communication is fine. No trigger to revisit — this was never going to be self-hosted infrastructure this
project builds.

## 17.7 DNS & Network Services — Pi-hole

**Template intent**: internal DNS filtering.

**Current state**: not adopted — no internal network exists to filter.

**Recommendation**: not applicable at ChrisPa's scale; public DNS through whatever registrar/DNS provider
hosts the eventual production domain is sufficient. No trigger foreseeable.

## 17.8 File Collaboration — Nextcloud

**Template intent**: self-hosted file storage/collaboration.

**Current state**: not adopted, and unrelated to the application's own (separate) user-upload storage gap —
`apps/api` currently serves user-uploaded avatars *and* product media from local disk (`uploads/avatars/`,
`uploads/products/`) with no object-storage/CDN integration (noted in `main.ts`, see
[`04-backend-development.md`](./04-backend-development.md)). That gap should be closed with a managed
object-storage service (S3-compatible), not Nextcloud, since it's a product feature (product images, user
avatars) rather than internal team file-sharing.

**Recommendation**: not applicable for internal team collaboration; separately, prioritize migrating
user-uploaded media to object storage before production (local disk storage doesn't survive a redeploy or
scale past one host).

## 17.9 Monitoring — Checkmk

**Template intent**: infrastructure/service health monitoring, certificate expiry, backup status.

**Current state**: not adopted — see [`12-observability-and-monitoring.md`](./12-observability-and-monitoring.md)
for the full observability gap and recommended adoption sequence.

**Recommendation**: a hosting provider's built-in monitoring, or a lightweight external uptime checker, plus
the Prometheus/Grafana path already recommended in the observability document, covers ChrisPa's needs without
operating a self-hosted Checkmk server. **Trigger**: enough self-hosted infrastructure (multiple VMs/services
outside a managed platform) that a dedicated monitoring server earns its keep — not the case today.

## 17.10 Backup & Disaster Recovery — Borg / borgmatic

**Template intent**: automated encrypted backups across heterogeneous data (files, configs, databases).

**Current state**: not adopted — see [`15-disaster-recovery.md`](./15-disaster-recovery.md) for the
recommended `pg_dump`-based alternative and why it's sufficient for ChrisPa's single-database footprint
today.

**Trigger to revisit**: once there's more than just the database to back up (e.g. object storage, multiple
databases, self-hosted infra config) such that deduplicated, multi-source backup tooling starts paying for
itself.

## Summary

| Tool | Adopted? | Right-sized alternative | Revisit when |
|---|---|---|---|
| Ansible | No | Manual, documented setup | Second production host |
| WireGuard | No | Provider firewall / security groups | Network-level compliance requirement |
| Traefik/Certbot | No | Managed LB with auto-TLS, or Traefik itself | **First public deployment (required)** |
| LXC | No | Docker alone | Not foreseen |
| iRedMail | No — but generic SMTP (`nodemailer`) + Africa's Talking SMS are already wired for registration OTP | Transactional email API for production | **Near-term (wire forgot-password/login-alerts/temp-password delivery to the existing services)** |
| Zulip/Slack | No | Whatever the team already uses | N/A — not a platform concern |
| Pi-hole | No | Public DNS via registrar | Not foreseen |
| Nextcloud | No | Object storage for product/user media | Before production (media survives redeploy) |
| Checkmk | No | Provider monitoring + Prometheus/Grafana later | Multi-VM self-hosted footprint |
| Borg/borgmatic | No | `pg_dump`-based backups | Multiple data sources beyond one DB |
