# Release Checklist

Use this checklist for each release candidate. Record the version and commit, and mark an item complete only after running it against that candidate.

## Candidate

- Version:
- Commit:
- Verification date:
- Verifier:

## Automated Quality Gates

- [ ] `npm ci` succeeds from the committed lockfile on Node.js 22.22 or newer.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:e2e` discovers and passes the Playwright browser smoke.
- [ ] The GitHub Actions quality and browser-smoke jobs pass for the candidate commit.

## Database And Container Smoke

- [ ] `npm run db:migrate` succeeds against a fresh SQLite data directory.
- [ ] Existing data upgrades without unexpected loss; review the migrations included since the previous release.
- [ ] `docker compose up --build -d` starts with a unique 32+ character `KOSU_SESSION_SECRET`.
- [ ] The container serves the setup screen for fresh data or the login screen for initialized data.
- [ ] Setup/login and dashboard access work through the container.
- [ ] Restarting the container with the same volume preserves workspace and login state.
- [ ] Backup and restore guidance has been reviewed against the current data layout.

## Security And Dependency Review

- [ ] `npm audit --omit=dev` has been reviewed for production dependency vulnerabilities.
- [ ] Full `npm audit` findings have been reviewed separately for development-toolchain exposure.
- [ ] No forced incompatible audit fix or dependency downgrade has been applied without migration testing.
- [ ] Production startup fails clearly when `KOSU_SESSION_SECRET` is missing or shorter than 32 characters.

## Scope, Documentation, And Rollback

- [ ] README, user guide, OpenSpec main specs, and application version describe the same supported scope.
- [ ] Supported reports are limited to effort, planned-versus-actual, and administrator-only project financial review.
- [ ] Full resource planning, accounting, invoicing, payroll, expenses, procurement, and multi-instance operation remain clearly out of scope.
- [ ] Rollback preserves the SQLite volume and does not require reversing a destructive migration.
- [ ] Release notes identify new migrations, configuration changes, accepted risks, and rollback limits.

## Current Dependency Review

- 2026-07-24: `npm audit --omit=dev --json` reported 0 production vulnerabilities.
- 2026-07-24: Full `npm audit --json` reported 4 moderate development-toolchain advisories through `drizzle-kit@0.31.10` → `@esbuild-kit/*` → `esbuild@0.18.20`.
- npm currently proposes `drizzle-kit@0.18.1` as the automatic fix, which is an incompatible downgrade. Do not apply `npm audit fix --force`; revisit when a compatible dependency path removes the deprecated loader.

## Verification Record

### 2026-07-24 — v0.6 stabilization working tree

- Candidate state: uncommitted local working tree; no release candidate commit has been pushed.
- `npm test` passed 38 files and 166 tests; typecheck, ESLint, and the production build passed.
- Playwright discovered and passed 1 Chromium smoke covering setup, logout/login, dashboard access, the supported planned-versus-actual report, browser console health, and the removed preview URL.
- Strict OpenSpec validation passed all 13 current specs and changes.
- A clean Compose build completed `npm ci`, the production build, and SQLite migrations. Setup redirected to the dashboard, and `/setup` continued redirecting to `/login` after a container restart with the same volume.
- The disposable validation container, network, and volume were removed after the persistence check.
- GitHub Actions has not run for this working tree. Keep the candidate checklist unchecked until a commit is pushed and the remote jobs pass.
