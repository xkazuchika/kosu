## 1. Project Financial Baseline

- [x] 1.1 Add nullable contract revenue and labor cost budget columns to projects while preserving the legacy revenue-or-budget value through a migration.
- [x] 1.2 Update project repository types and project create/edit forms so administrators can manage the separate tax-exclusive yen amounts.
- [x] 1.3 Update project CSV import, export, templates, and validation for the two new amounts without auto-classifying legacy values.
- [x] 1.4 Show an administrator-only migration cue when a project has a legacy amount but no new financial baseline.

## 2. Financial Aggregation

- [x] 2.1 Add project financial aggregation that derives selected-month planned and actual labor cost from saved rate snapshots.
- [x] 2.2 Add cumulative actual labor cost, labor budget remaining amount, budget consumption, and applicable labor-margin calculations.
- [x] 2.3 Track planned and actual hours without snapshots separately so incomplete cost data is never treated as zero cost.
- [x] 2.4 Keep financial aggregates and project financial inputs inaccessible to non-administrator loaders and actions.

## 3. Administrator Review

- [x] 3.1 Add an administrator-only project financial review route with month context and project-level financial status.
- [x] 3.2 Present active-project budget consumption and target labor-margin metrics distinctly from archived-project final labor-margin metrics.
- [x] 3.3 Keep internal and non-billable projects useful for cost tracking without presenting missing revenue as profit.
- [x] 3.4 Add role-aware navigation and contextual links between project details, financial review, and monthly review workflows.

## 4. Documentation And Verification

- [x] 4.1 Document the direct-labor-only metric definitions, tax-exclusive input convention, legacy value migration, and excluded accounting scope.
- [x] 4.2 Add repository, service, and route tests for financial baseline persistence, snapshot-based calculations, missing-rate handling, archived-project final margin, and access control.
- [x] 4.3 Run OpenSpec validation, targeted tests, full test suite, typecheck, lint, and build.
