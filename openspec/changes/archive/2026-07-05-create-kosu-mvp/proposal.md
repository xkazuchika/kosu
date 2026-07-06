## Why

Small teams and departments often need a simple way to plan and review effort without adopting a heavy SaaS project-management suite or sending internal work and cost data to a third party. `kosu` will provide a lightweight, self-hosted OSS effort-management tool focused on assigned project work, monthly resource planning, daily actual effort allocation, and administrator-facing cost/profit reporting.

## What Changes

- Introduce the first usable MVP of `kosu` as a self-hosted web application.
- Add local workspace setup for a small team, including the first administrator account.
- Add team member accounts with department attributes, administrator-only hourly cost rates, and role-based access suitable for self-hosted use.
- Add projects with code, type, client, revenue/budget amount, tasks, assigned members, self-assignment for existing active projects, and assignment roles as the primary targets for effort tracking.
- Add monthly capacity and planned effort by member and project so managers can estimate project workload and member availability before actuals are entered.
- Add daily work-log workflows where members enter total working hours and allocate those hours across assigned projects.
- Add a lightweight OSS-style UI/UX direction with role-aware navigation, simple daily input, admin-focused operational views, and public-repository screenshot readiness.
- Add dashboard summaries, project, member, period, planned-vs-actual, cost, and gross-profit reporting with CSV export for lightweight analysis.
- Add CSV import flows for member, project, assignment, capacity, and monthly plan setup so trial usage does not require excessive manual entry.
- Add month locking so administrators can close a reporting period and prevent accidental changes after review.
- Add deployment and operational requirements for single-instance self-hosting.

## Capabilities

### New Capabilities

- `workspace-setup`: Initial application setup, workspace configuration, and administrator onboarding.
- `team-members`: Member account management, authentication, department attributes, administrator-only cost rates, and role-based access.
- `work-items`: Project code/type, task, project financial metadata, assignment role, administrator assignment, and self-assignment management used as targets for effort allocation.
- `monthly-plans`: Monthly member capacity and planned effort by member/project for resource planning, workload estimation, and planned-vs-actual reporting.
- `time-entries`: Daily work logging, allocation across assigned projects, editing, validation, and personal entry review.
- `ui-ux`: Product navigation, visual direction, responsive behavior, empty states, and role-specific information hierarchy.
- `dashboard`: Role-appropriate landing dashboards that surface input status, assigned work, planning variance, and administrator alerts.
- `reports`: Aggregated capacity, planned-vs-actual effort reports by member, project, task, role, department, and period, including administrator-only cost/profit views and CSV export.
- `data-import-export`: CSV templates, validation, imports, and non-report exports for setup and operational data.
- `period-locking`: Month close and unlock controls that protect reviewed plans and actuals from accidental edits.
- `self-hosting`: Deployment, configuration, persistence, and basic operational behavior for small self-hosted installations.

### Modified Capabilities

- None.

## Impact

- Establishes the product scope, domain model, application architecture, and implementation plan for the initial repository.
- Introduces a web UI, UI/UX direction, server-side application logic, database persistence, authentication/session handling, assignment controls, monthly planning, dashboards, period locking, financial visibility controls, CSV import/export behavior, and OSS trial documentation.
- Requires project setup for development, tests, local self-hosting, and production deployment documentation.
