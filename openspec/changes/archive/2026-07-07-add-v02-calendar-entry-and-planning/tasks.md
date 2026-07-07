## 1. Monthly Work-Log Bulk Entry

- [x] 1.1 Add route tests for monthly work-log loader rows, member/admin target-member behavior, validation, and locked-period handling.
- [x] 1.2 Implement month/date utilities needed to render all days in a selected month.
- [x] 1.3 Implement monthly work-log loader that returns one row per day with total hours, allocated total, variance, status, lock state, and daily detail URL.
- [x] 1.4 Implement monthly work-log action that creates or updates daily total working hours for submitted days without changing allocations.
- [x] 1.5 Build the monthly work-log UI with month selector, optional admin member selector, daily total inputs, status badges, and daily detail links.

## 2. Planning and Reporting Workflow

- [x] 2.1 Add or update tests for planned-versus-actual supported visibility and calculations using monthly capacity, monthly plans, and actual allocations.
- [x] 2.2 Promote planned-versus-actual report UI from v0.2+ preview to supported v0.2 wording and navigation.
- [x] 2.3 Add workflow links between monthly bulk entry, daily entry, monthly plans, and planned-versus-actual report.
- [x] 2.4 Ensure missing monthly plans show guidance rather than treating the report as an error.

## 3. Verification

- [x] 3.1 Run targeted route/component tests for work logs, monthly plans, reports, and navigation.
- [x] 3.2 Run full typecheck, lint, test, and production build.
- [x] 3.3 Smoke test the v0.2 workflow on the local demo server.
