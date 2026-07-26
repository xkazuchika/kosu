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
- [x] The GitHub Actions quality and browser-smoke jobs pass for the candidate commit.

## Database And Container Smoke

- [ ] `npm run db:migrate` succeeds against a fresh SQLite data directory.
- [ ] Existing data upgrades without unexpected loss; review the migrations included since the previous release.
- [ ] Active legacy `period_locks` rows migrate to `in_review`; unlocked rows remain open and the legacy table remains present.
- [ ] Monthly close review, blocker display, explicit cost correction, approval snapshot, and reason-required reopen work against upgraded data.
- [ ] In-review and approved months reject member and administrator writes through work logs, allocations, plans, capacities, copy-to-actual, and CSV imports.
- [ ] Approved project financial views remain unchanged after project baseline, member-rate, archive-state, and future-actual edits.
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
- [ ] Monthly-close release notes state that snapshots cover direct labor cost only and exclude external, subcontractor, expense, and indirect costs.
- [ ] Rollback preserves the SQLite volume and does not require reversing a destructive migration.
- [ ] Release notes identify new migrations, configuration changes, accepted risks, and rollback limits.

## Current Dependency Review

- 2026-07-24: `npm audit --omit=dev --json` reported 0 production vulnerabilities.
- 2026-07-24: Full `npm audit --json` reported 4 moderate development-toolchain advisories through `drizzle-kit@0.31.10` → `@esbuild-kit/*` → `esbuild@0.18.20`.
- npm currently proposes `drizzle-kit@0.18.1` as the automatic fix, which is an incompatible downgrade. Do not apply `npm audit fix --force`; revisit when a compatible dependency path removes the deprecated loader.
- 2026-07-26: React Router was pinned to `8.3.0` to resolve the production RSC-mode advisory, and `better-sqlite3` was pinned to `12.11.1` for compatibility with the `node:22-slim` container runtime.
- 2026-07-26: `npm audit --omit=dev` again reported 0 production vulnerabilities. The full audit still reports only the four moderate Drizzle development-toolchain advisories above.

## Verification Record

### 2026-07-24 — v0.6 stabilization working tree

- Candidate state: pushed `main` commit; GitHub Actions completed successfully for the candidate.
- `npm test` passed 38 files and 166 tests; typecheck, ESLint, and the production build passed.
- Playwright discovered and passed 1 Chromium smoke covering setup, logout/login, dashboard access, the supported planned-versus-actual report, browser console health, and the removed preview URL.
- Strict OpenSpec validation passed all 13 current specs and changes.
- A clean Compose build completed `npm ci`, the production build, and SQLite migrations. Setup redirected to the dashboard, and `/setup` continued redirecting to `/login` after a container restart with the same volume.
- The disposable validation container, network, and volume were removed after the persistence check.
- GitHub Actions `CI` workflow completed successfully for the pushed candidate, including quality and browser-smoke jobs.

### 2026-07-26 — monthly-close working tree

- OpenSpec reports 21 of 21 tasks complete, and strict validation passes all 13 current specs and changes.
- `npm test` passes 40 files and 178 tests; typecheck, ESLint, the production build, and the production-server Playwright smoke pass.
- A clean Compose build completes `npm ci`, the production build, and migrations. Setup and login succeed, and the initialized workspace remains available after a container restart with the same volume.
- The production dependency audit reports 0 vulnerabilities. Four moderate development-only Drizzle toolchain advisories remain accepted pending a compatible upstream fix.
- GitHub Actions remains to be confirmed after the candidate is committed and pushed.
