## 1. Monthly Planning Behavior

- [x] 1.1 Add route tests showing monthly planned effort can be created and viewed without member capacity.
- [x] 1.2 Add route tests for updating and deleting existing monthly project plan rows.
- [x] 1.3 Refactor monthly planning admin loader to return existing plan rows with member and project display names for the selected month.
- [x] 1.4 Implement admin actions for explicit monthly plan update and delete from visible plan rows.

## 2. Planning UI Redesign

- [x] 2.1 Reorder monthly planning admin UI so project planned effort entry and existing plan rows are primary.
- [x] 2.2 Move capacity controls into a secondary optional context section with clearer copy.
- [x] 2.3 Update member monthly plan view to show project planned effort first and handle missing capacity as optional context.
- [x] 2.4 Update navigation/copy labels that imply capacity is required planned effort.

## 3. Planned-Versus-Actual Reporting

- [x] 3.1 Add or update report tests for planned-versus-actual when capacity is missing.
- [x] 3.2 Update planned-versus-actual UI to avoid capacity-required empty states when project plans or actuals exist.

## 4. Verification

- [x] 4.1 Run targeted tests for monthly plans, reports, and app shell navigation.
- [x] 4.2 Run full typecheck, lint, test, and build.
- [x] 4.3 Smoke test the v0.3 planning workflow on the local demo server.

## 5. Roadmap Scope

- [x] 5.1 Document project-cost management target areas and explicit non-goals in the v0.3 proposal and design.
- [x] 5.2 Add OpenSpec deltas for daily allocation plans, project financial planning, and profitability reporting as future scope boundaries.

## 6. v0.3 UI Polish

- [x] 6.1 Add target-month controls to administrator and member monthly planning screens.
- [x] 6.2 Remove stale fixed header month/title behavior from the shared app shell.
- [x] 6.3 Hide administrator-only planning links from non-administrator monthly planning views.
- [x] 6.4 Align planning terminology and remove stale version badges from planned-versus-actual.
- [x] 6.5 Make destructive monthly planning actions visually distinct from save actions.
- [x] 6.6 Add or update route/component tests for the v0.3 UI polish.
- [x] 6.7 Run validation, targeted tests, and full verification.
