# 08. Source Code Management and CI/CD

Adapts template §6 (GitLab/source management) and §7 (GitLab Runner CI/CD).

## Current state

- **GitHub is the chosen remote**: `https://github.com/obekegodfreyvicent/chrispa`, single branch (`main`),
  no protected-branch rules, no required pull-request reviews, no branch-naming convention enforced yet — the
  hosting-platform decision below has been made, the process discipline around it has not.
- **No CI pipeline exists** — no `.github/workflows/`, no equivalent. Tests (`npm run test`, `npm run
  test:e2e` per workspace) and lint run only when a developer runs them locally; nothing gates a push to
  `main` on them passing.
- **CD exists, but only in the "deploy on push" sense, with no CI gate in front of it**: Render (`chrispa-api`)
  and Netlify (`chrispa-storefront`, `chrispa`) each watch `main` directly and auto-deploy on every push —
  see [`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md) for
  the live URLs and config. This is genuinely continuous *deployment*, but not continuous *integration*: a
  push with a failing test (or no tests at all for the changed code) still deploys straight to production,
  gated only by each platform's own build step succeeding. Adding a GitHub Actions `lint`/`test` workflow that
  runs on every push — and, ideally, blocks the platforms' auto-deploy on failure, or at minimum blocks merge
  to `main` via a required status check — is the single highest-value gap to close next.

This — a CI pipeline in front of the deploy that already happens — is now the largest single gap relative to
the template, which assumes GitLab + GitLab Runner running both CI and CD together.

## Hosting platform — decided

**GitHub** was chosen (see Current state above) — the broadest ecosystem/Actions marketplace, cloud-hosted.
The template's self-hosted GitLab framing was evaluated and not required for ChrisPa's scale; nothing in
`apps/api`/`apps/storefront`/`apps/admin` is GitLab-specific, so this remains reversible if a data-residency
or cost-at-scale reason ever comes up.

## Recommended branching and review practice (process discipline still to adopt)

- Protected `main` branch; no direct pushes for anything beyond trivial fixes.
- Feature branches, merged via pull/merge request — the codebase already has `CLAUDE.md`-documented
  conventions worth enforcing through required reviews (e.g. the `tx`-passthrough pattern for transactional
  Prisma calls, the audit-log-on-update pattern in `EmployeesService`).
- Conventional, meaningful commit messages; semantic versioning once the API or a shared package has external
  consumers (not yet the case).
- `.env`, `apps/api/.env`, and anything matching common secret patterns must never be committed — verify with
  `git status` after any broad `git add` before every commit, per this repo's own operating rules
  (see `CLAUDE.md`).

## Recommended CI pipeline (not yet built — GitHub Actions is the natural runner, now that GitHub is chosen)

Adapting the template's stage list (§7) to what this monorepo actually needs:

| Stage | What it would run |
|---|---|
| `lint` | `npm run lint --workspace apps/api`, same for `storefront`/`admin` |
| `unit-test` | `npm run test --workspace apps/api` (Jest) |
| `integration-test` | `npm run test:e2e --workspace apps/api` against an ephemeral Postgres service container |
| `build` | `npm run build:api`, `build:storefront`, `build:admin` |
| `deploy-staging` | Not yet possible — no staging environment exists (see [`09-containerization-and-environments.md`](./09-containerization-and-environments.md)) |
| `approval` | Manual gate before production, once staging exists to gate from |
| `deploy-production` | **Already happens today** — Render/Netlify auto-deploy `main` directly, but with none of the stages above running first (see [`11-deployment-and-configuration-management.md`](./11-deployment-and-configuration-management.md)) |

`security-check` and `package/publish` stages from the template apply once container images are being built
(see [`09-containerization-and-environments.md`](./09-containerization-and-environments.md)); until app
Dockerfiles exist, they have nothing to scan or publish.

This is a recommendation, not a built pipeline — the `lint`/`unit-test`/`integration-test`/`build` stages
could be added as a GitHub Actions workflow today, independent of the staging-environment work, and would
immediately start catching regressions before they reach the production deploy that already runs on every
push.

## Infrastructure-as-code in version control

Not applicable yet — there is no Ansible/deployment configuration to version (see
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md)). `docker-compose.yml`
(Postgres/Redis for local dev) is already committed, satisfying the template's spirit for what does exist.
