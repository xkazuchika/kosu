## 1. Workspace Calendar Foundation

- [x] 1.1 Add timezone validation/normalization and pure helpers that derive workspace-local `YYYY-MM-DD` and `YYYY-MM` values from an injectable reference time.
- [x] 1.2 Add a workspace calendar context service that reads the configured timezone, returns today/current month, and falls back to UTC with an administrator-visible warning for legacy invalid values.
- [x] 1.3 Validate timezone input in initial setup and workspace settings, preserving the prior value on invalid updates.
- [x] 1.4 Add fixed-time unit and route tests for valid/invalid timezones, UTC-to-Tokyo day and month boundaries, fallback behavior, and unchanged UTC persistence timestamps.

## 2. Calendar-Aware Workflows

- [x] 2.1 Replace UTC string-slicing defaults in dashboard and daily work-log navigation with workspace-local today.
- [x] 2.2 Replace current-month defaults in work-log lists, daily/monthly planning, and supported reports with the shared workspace calendar context.
- [x] 2.3 Preserve explicitly selected valid dates/months and add regression tests for missing, invalid, and historical query values.

## 3. Supported Report Cleanup

- [x] 3.1 Remove the obsolete `/reports/resource-planning` route registration and preview implementation.
- [x] 3.2 Add route/documentation coverage showing that supported capacity comparison remains available through planned-versus-actual and the obsolete URL returns not found.

## 4. Browser Smoke And CI

- [x] 4.1 Configure Playwright to bind the development server to `127.0.0.1` with an isolated temporary data directory and valid test-only session secret.
- [x] 4.2 Add a Chromium smoke test that completes fresh setup, signs in, and reaches the authenticated dashboard.
- [x] 4.3 Add a GitHub Actions quality job using Node.js 22.22 or newer and `npm ci` to run Vitest, typecheck, ESLint, and the production build.
- [x] 4.4 Add a separate Playwright smoke job with Chromium installation, failure traces/reports, and zero-test failure behavior.

## 5. Release Documentation And Verification

- [x] 5.1 Replace the v0.1-specific release checklist with a reusable candidate checklist for quality gates, migrations, Docker startup, setup/login reachability, SQLite persistence, and rollback review.
- [x] 5.2 Record production and full dependency audit results separately, retaining the accepted dev-tool advisory without applying a forced incompatible fix.
- [x] 5.3 Update README and OpenSpec-facing documentation to remove stale preview/version wording and describe only supported report surfaces.
- [x] 5.4 Run relevant boundary/route tests, the full Vitest suite, typecheck, lint, production build, Playwright smoke, strict OpenSpec validation, and Docker persistence smoke; record only completed verification.
