# 08. Source Code Management and CI/CD

Adapts template §6 (GitLab/source management) and §7 (GitLab Runner CI/CD).

## Current state

- Local git repository only — **no remote (`origin`) is configured** in this environment
  (`git remote -v` returns nothing). No hosting platform (GitHub, GitLab, or otherwise) has been chosen yet.
- Single branch (`main`); no protected-branch rules, no required merge-request reviews, no branch-naming
  convention enforced, because there is no shared remote to enforce them on.
- **No CI/CD pipeline exists** — no `.gitlab-ci.yml`, no `.github/workflows/`, no equivalent. Tests
  (`npm run test`, `npm run test:e2e` per workspace) run only when a developer runs them locally.

This is the largest single gap relative to the template, which assumes GitLab + GitLab Runner specifically.

## Recommendation — hosting platform

The template names GitLab, but nothing about ChrisPa's stack requires it specifically. Either **GitHub** (if
the team wants the broadest ecosystem/Actions marketplace and is fine with a cloud-hosted platform) or a
**self-hosted GitLab** (if the "self-hosted platform" framing from the template's title is a hard
requirement — e.g. a data-residency or cost-at-scale reason) work equally well with this codebase; nothing in
`apps/api`/`apps/storefront`/`apps/admin` is GitLab-specific. This is a decision for the project owner, not
one to make unilaterally — record it here once made.

## Recommended branching and review practice (once a remote exists)

- Protected `main` branch; no direct pushes for anything beyond trivial fixes.
- Feature branches, merged via pull/merge request — the codebase already has `CLAUDE.md`-documented
  conventions worth enforcing through required reviews (e.g. the `tx`-passthrough pattern for transactional
  Prisma calls, the audit-log-on-update pattern in `EmployeesService`).
- Conventional, meaningful commit messages; semantic versioning once the API or a shared package has external
  consumers (not yet the case).
- `.env`, `apps/api/.env`, and anything matching common secret patterns must never be committed — verify with
  `git status` after any broad `git add` before every commit, per this repo's own operating rules
  (see `CLAUDE.md`).

## Recommended CI pipeline (once a remote + runner exist)

Adapting the template's stage list (§7) to what this monorepo actually needs:

| Stage | What it would run |
|---|---|
| `lint` | `npm run lint --workspace apps/api`, same for `storefront`/`admin` |
| `unit-test` | `npm run test --workspace apps/api` (Jest) |
| `integration-test` | `npm run test:e2e --workspace apps/api` against an ephemeral Postgres service container |
| `build` | `npm run build:api`, `build:storefront`, `build:admin` |
| `deploy-staging` | Not yet possible — no staging environment exists (see [`09-containerization-and-environments.md`](./09-containerization-and-environments.md)) |
| `approval` | Manual gate before production, once production exists |
| `deploy-production` | Not yet possible — no production environment exists |

`security-check` and `package/publish` stages from the template apply once container images are being built
(see [`09-containerization-and-environments.md`](./09-containerization-and-environments.md)); until app
Dockerfiles exist, they have nothing to scan or publish.

This is a recommendation, not a built pipeline — implementing it is future work gated on picking a hosting
platform first.

## Infrastructure-as-code in version control

Not applicable yet — there is no Ansible/deployment configuration to version (see
[`17-infrastructure-platform-roadmap.md`](./17-infrastructure-platform-roadmap.md)). `docker-compose.yml`
(Postgres/Redis for local dev) is already committed, satisfying the template's spirit for what does exist.
