# Kosu v0.1 Release Checklist

Use this checklist before publishing a v0.1 release.

## Required Verification

- [x] Run `npm run typecheck`. Verified on 2026-07-06.
- [x] Run `npm run lint`. Verified on 2026-07-06.
- [x] Run `npm run test`. Verified on 2026-07-06: 32 files / 115 tests passed.
- [x] Run `npm run build`. Verified on 2026-07-06.
- [x] Run Docker build/start in an environment with Docker available. Verified on 2026-07-06 with Colima and `docker-compose up --build -d`.
- [x] Confirm the Docker container serves the setup or login screen. Verified on 2026-07-06 with `GET /setup` returning `200 OK`.
- [x] Confirm the Docker volume preserves SQLite data after container restart. Verified on 2026-07-06 by completing setup, restarting the container, and confirming `/setup` redirects to `/login`.

## Documentation Checks

- [x] Confirm `README.md` describes v0.1 as a lightweight self-hosted effort management tool.
- [x] Confirm `README.md` does not present financial reporting, gross profit reporting, full resource planning, or complete planned-vs-actual reporting as v0.1 features.
- [x] Confirm the SQLite single-instance self-host limitation is clearly documented.
- [x] Confirm high concurrency, multi-instance, and multi-tenant SaaS use cases are documented as out of scope for v0.1.
- [x] Confirm Docker instructions do not claim verification unless a Docker smoke test has been run.

## OpenSpec Scope Checks

- [x] Confirm v0.1 specs keep basic effort reports and CSV export in scope.
- [x] Confirm financial reporting is listed as v0.2+ or future scope.
- [x] Confirm full resource planning is listed as v0.2+ or future scope.
- [x] Confirm full planned-versus-actual reporting is listed as v0.2+ or future scope.

## Known Issues To Review

- [x] Review `npm audit --audit-level=moderate` output. Current known moderate advisories are from the dev/build toolchain path through `drizzle-kit` and `esbuild`; avoid forced breaking updates unless validated.
- [x] Review npm install allow-scripts warnings for native/build dependencies such as `better-sqlite3` and `esbuild`.
- [x] Decide whether to pin or update dependencies before tagging v0.1. Decision: do not force-update for v0.1; keep the lockfile and revisit when `drizzle-kit` removes the vulnerable transitive `@esbuild-kit/*` path or a non-breaking update is available.
- [x] Confirm no screenshots or placeholder image paths in README point to missing files.

## Release Decision

- [x] Confirm no v0.1 page promises ERP, payroll, invoicing, expense management, complex approvals, Gantt charts, ticket management, auto timers, or full profitability management.
- [x] Confirm admin/member two-role authorization is acceptable for v0.1.
- [x] Confirm remaining report preview routes are clearly marked as v0.2+ preview or are hidden from primary navigation.

## Latest Verification Notes

- 2026-07-06: `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` passed.
- 2026-07-06: Docker build/start smoke test passed with Colima using `docker-compose up --build -d`; `GET /setup` returned `200 OK`.
- 2026-07-06: Docker volume persistence smoke test passed. After setup, container restart preserved workspace state and `GET /setup` returned a `302` redirect to `/login`.
- 2026-07-06: `npm audit --json`, `npm outdated`, and `npm ls drizzle-kit @esbuild-kit/esm-loader @esbuild-kit/core-utils esbuild` were reviewed.
- 2026-07-06: `npm audit --audit-level=moderate` still reports 4 moderate advisories through `drizzle-kit@0.31.10` -> `@esbuild-kit/*` -> `esbuild@0.18.20`. Runtime `vite` and `tsx` use newer `esbuild@0.28.1`; `drizzle-kit` also has `esbuild@0.25.12`, but its deprecated transitive loader path remains vulnerable.
- 2026-07-06: `npm audit fix --force` would install `drizzle-kit@0.18.1` and introduce a breaking downgrade path, so it was not applied. v0.1 accepts this as a dev/build-toolchain advisory and tracks it for follow-up.
