## Context

`kosu` starts from an empty application repository with only OpenSpec planning files. The first change establishes the product, architecture, data model, and MVP implementation plan for a small-team, self-hosted OSS effort-management tool.

The primary users are small teams or company departments that need to assign members to projects, plan monthly capacity and effort, enter daily actual effort, and review project economics without adopting a heavy SaaS platform. The deployment target is a single self-hosted instance operated by the team, not a hosted multi-tenant service.

## Goals / Non-Goals

**Goals:**

- Provide a complete MVP web application for setup, login, member management, project/task/assignment management, monthly capacity and planned effort, daily allocation-based actuals, dashboards, period locking, reports, and CSV import/export.
- Provide a lightweight, modern UI that feels approachable as a public OSS tool while staying clear enough for business users.
- Keep deployment simple with one application service and one persistent SQLite database volume.
- Prefer boring, inspectable technology suitable for OSS contributors and small self-hosted installs.
- Make the domain model explicit enough to support future extensions such as approvals, billing, detailed rate history, or external integrations.

**Non-Goals:**

- Hosted SaaS multi-tenancy, organization billing, or subscription management.
- SSO, OAuth, LDAP, SCIM, or enterprise identity integrations.
- Mobile native applications.
- Payroll, invoicing, approvals, or utilization forecasting.
- Offline-first synchronization.

## Decisions

### Single Web Application

Build `kosu` as one TypeScript web application that serves both UI and server-side routes. This keeps local development, deployment, and documentation simple for the initial OSS release.

Alternatives considered:
- Separate API and frontend services: clearer boundaries, but more moving parts for a small self-hosted app.
- Desktop or CLI-first app: lighter runtime, but worse for team collaboration and reports.

### Recommended Implementation Baseline

Use React Router / Remix-style full-stack routing, Tailwind CSS with shadcn/ui-style components, Drizzle ORM, SQLite, Vitest, and Playwright for the MVP implementation. Publish the project under the MIT license. The initial product language is Japanese-first, with a Japanese README and English summary for public GitHub discoverability. Currency defaults to JPY and effort inputs use 0.25 hour increments.

Alternatives considered:
- Next.js: broadly adopted, but React Router / Remix-style data and form handling better matches this form-heavy business app.
- Mantine or fully custom CSS: viable, but Tailwind plus shadcn/ui-style components gives a lightweight OSS-friendly look with less bespoke UI work.
- PostgreSQL as the required database: more scalable, but increases self-hosting burden for the target MVP.
- Apache-2.0 or AGPL license: valid OSS choices, but MIT maximizes ease of adoption for departments and small teams trying the tool.

### SQLite as the Default Database

Use SQLite as the default persistence layer with a file stored in a mounted data directory. Drizzle ORM provides typed data access and migration management. The MVP is for small teams and single-instance deployment, where SQLite minimizes operational burden.

Alternatives considered:
- PostgreSQL: more scalable and familiar for larger teams, but adds an extra required service.
- In-memory or file-based JSON storage: easier to prototype, but unsafe for concurrent edits and reporting queries.

### Local Accounts and Cookie Sessions

Use local email/password accounts with secure password hashing and HTTP-only cookie sessions. The initial setup flow creates the first administrator before normal login is enabled.

Alternatives considered:
- Passwordless email login: nice UX, but requires mail delivery configuration.
- OAuth-only login: convenient for some teams, but conflicts with low-friction self-hosting.

### Workspace-Scoped Domain Model

Model a single workspace per installation. Core tables are workspace settings, members, sessions, projects, tasks, project assignments, member monthly capacities, monthly plans, daily work logs, time allocations, period locks, import jobs, and audit timestamps. This avoids premature multi-tenant complexity while preserving clear ownership boundaries.

Alternatives considered:
- Multi-workspace schema from day one: future-friendly, but adds tenant selection and authorization complexity.
- No workspace model: simpler, but makes setup, naming, and future migration less explicit.

### Departments as Member Attributes

Store department as an optional member attribute instead of introducing a separate department master in the MVP. This supports department filtering and reporting while keeping setup lightweight.

Alternatives considered:
- Department master table: more normalized and useful for strict governance, but unnecessary until teams need department lifecycle management.
- No department field: simpler, but loses a common reporting dimension for company-department use.

### Project Financial Metadata and Member Cost Rates

Store project revenue/budget amount on projects and hourly cost rate on members. Cost rates and project financial fields are administrator-only data; regular members do not see these values in time-entry screens.

Alternatives considered:
- Omit financial fields from MVP: keeps scope smaller, but prevents project profitability reporting, which is central to the clarified use case.
- Full rate-card/history model: more accurate for long-running organizations, but too heavy for an MVP.

### Projects as Unified Work Buckets

Represent customer work, internal work, and non-billable customer work as projects with a unique project code and project type. This keeps effort allocation and reporting consistent instead of creating a separate internal-work model.

Alternatives considered:
- Separate internal work categories: simpler for internal tasks, but splits reports and input flows.
- Free-text project names only: easier setup, but weak for CSV import, search, and public demo data.

### Cost Rate Snapshots on Allocations and Plans

Copy the member's hourly cost rate into monthly plans and time allocations when records are created. Reports use the snapshot so historical cost and gross-profit numbers do not change when an administrator later updates a member's master cost rate.

Alternatives considered:
- Always calculate using the current member cost rate: simpler, but changes historical reports after rate updates.
- Separate effective-dated cost history: more precise, but adds significant data-entry and migration complexity.

### Assignment-Gated Project Input

Require members to allocate actual effort only to projects they are assigned to. Administrators manage project assignments, including an optional assignment role such as PM, Engineer, Designer, Support, or internal work, and can view all projects. Members can also self-assign only themselves to existing active projects from search when they need to handle ad-hoc work that was requested but not pre-assigned.

Alternatives considered:
- Let all members enter against any active project: simpler, but creates noisy reports and accidental entries.
- Assign only at task level: more granular, but too much management overhead for lightweight use.
- Separate role master table: cleaner for strict role governance, but a free-text or small controlled role field is lighter for the MVP.

### Self-Assignment Source Tracking

Track whether a project assignment was created by an administrator or by member self-assignment. Self-assigned rows allow immediate actual entry for an existing project while giving administrators visibility into ad-hoc assignment changes.

Alternatives considered:
- Require administrators to assign every project before entry: cleaner governance, but blocks common last-minute work requests.
- Let members allocate to any project without creating an assignment: easier input, but loses an auditable assignment trail.

### Monthly Capacity and Resource Planning

Store monthly capacity per member and month separately from monthly planned effort. Capacity represents how many hours the member is available that month; monthly plans distribute that capacity across projects and assignment roles. Reports compare capacity, planned hours, unallocated capacity, and overplanned hours.

Alternatives considered:
- Derive capacity from a fixed workspace default: simple, but cannot handle part-time members, leave, or different working arrangements.
- Daily scheduling: more precise, but too heavy for the first version and not needed for month-level resource planning.

### Daily Work Log with Allocations

Use a two-level actuals model: a daily work log records a member's total working hours for a date, and child allocations distribute those hours across assigned projects and optional tasks. The UI should show allocated total and unallocated hours; incomplete allocation is allowed with a warning so members can save drafts or partial days.

Alternatives considered:
- Independent time entries only: simpler schema, but makes daily reconciliation harder for users.
- Require allocation totals to exactly match working hours before save: cleaner data, but too strict for incremental entry.

### Monthly Plans by Member and Project

Use monthly plans to record planned hours for each member/project/month before actuals are entered. Plans can include the assignment role and are separate from daily logs so managers can compare capacity, plan, and actual by project, member, role, department, and month.

Alternatives considered:
- Project-level planned hours only: easier entry, but cannot compare individual planned workload against actuals.
- Daily planned hours: more precise, but too heavy for the MVP.

### Server-Side Authorization

Enforce permissions in server-side route handlers and data-access functions. The UI may hide unauthorized controls, but backend checks are the source of truth. Financial fields, cost rates, and profit reports must be administrator-only even if a regular member can see the related project name or their own effort.

Alternatives considered:
- UI-only authorization: simpler, but insecure.
- Policy engine dependency: flexible, but excessive for two MVP roles.

### Period Locking

Allow administrators to lock a month after reviewing plans and actuals. Locked months prevent non-administrator edits to monthly capacity, monthly plans, daily work logs, and allocations. Administrators can unlock a month when corrections are needed.

Alternatives considered:
- No locking in MVP: simpler, but weak for real monthly operations where reviewed data should stop changing.
- Full approval workflow: more robust, but too heavy for a lightweight first release.

### CSV Setup Imports

Support CSV templates and imports for the setup-heavy entities: members, projects, project assignments, member monthly capacities, and monthly plans. Imports use validation previews before committing rows. This lowers the barrier for departments trying the public OSS project with existing spreadsheet data.

Alternatives considered:
- Manual entry only: simpler, but makes trials tedious and makes the public repo feel less useful.
- Spreadsheet sync integrations: powerful, but adds external dependencies and account setup.

### Role-Aware Dashboards

Provide a dashboard as the landing page after login. Regular members see today/month input status, assigned projects, planned-vs-actual personal summaries, and allocation warnings. Administrators additionally see unentered or incomplete logs, overplanned members, project economics summaries, and locked-period status.

Alternatives considered:
- Reports-only navigation: easier to implement, but gives a poor first impression and hides operational alerts.
- Fully customizable dashboard: attractive, but unnecessary for MVP.

### UI/UX Direction

Use a lightweight OSS tool visual direction: neutral background, restrained accent color, compact cards, readable tables, and clear form states. The interaction model should feel closer to a modern developer-friendly SaaS/admin tool than a heavy legacy business system, while preserving Japanese business-app clarity. UI copy is Japanese-first for the MVP, with code structured so English copy can be added later.

The application shell uses a left sidebar for primary navigation: Dashboard, Work Logs, Monthly Plans, Projects, Members, Reports, Import/Export, and Settings. The top area carries the current month/date context, user menu, and role-specific actions. Daily work-log entry should be optimized for speed and should work on mobile; planning, reports, imports, and administration can be desktop-first but must remain readable on smaller screens.

Alternatives considered:
- Traditional dense enterprise UI: familiar, but risks making the OSS project feel old and heavy.
- Highly visual consumer-style UI: attractive, but inefficient for tables, forms, and reporting.
- Minimal API-first UI: easier to build, but weak for public repo screenshots and trial usage.

### Reports from Query-Time Aggregation

Compute MVP reports directly from monthly plans, daily work logs, and time allocations using filtered database queries. Persisted report snapshots are out of scope until there is a retention, approval, or audit requirement.

Alternatives considered:
- Precomputed aggregates: faster for large datasets, but unnecessary for small teams and harder to keep correct.
- Export-only reporting: simpler, but teams need quick in-app visibility.

## Risks / Trade-offs

- SQLite write contention can appear if the tool is used by larger teams -> Scope the MVP to small teams and document single-instance expectations.
- Custom local authentication can introduce security defects -> Use established password hashing, secure cookies, server-side sessions, and focused auth tests.
- A single application service couples UI and backend changes -> Accept this for MVP simplicity and keep route/data modules separated.
- Financial fields are sensitive -> Keep cost rates, revenue amounts, cost totals, and gross-profit reports behind administrator-only server-side authorization.
- Reports may become slow with large historical datasets -> Add indexes for month, date, member, role, department, project, and task filters; defer precomputed aggregates.
- Capacity plans can be mistaken for a detailed schedule -> Keep the MVP explicitly month-level and label the feature as resource planning, not calendar scheduling.
- Allowing unallocated daily hours can leave incomplete actuals -> Show clear warnings in entry screens and reports so administrators can follow up.
- CSV import can corrupt data if applied blindly -> Validate imports first, show row-level errors, and only commit valid confirmed imports.
- Period locks can block legitimate corrections -> Allow administrators to unlock periods and keep the lock state visible.
- Self-assignment can add noisy assignments -> Limit self-assignment to existing active projects, record the source, and surface self-assigned rows to administrators.
- A polished UI can expand scope -> Keep the visual system simple and prioritize reusable layout, form, table, empty-state, and status components.
- Self-hosted deployments vary widely -> Provide a Docker-based default path and keep required environment variables minimal.

## Migration Plan

This is the first application implementation, so there is no user-data migration. The implementation will introduce database migrations from an empty database and document the data directory that must be backed up.

Rollback for the MVP is limited to restoring the previous container image and database backup. Destructive schema changes are out of scope for this initial change.

## Open Questions

- Whether to add PostgreSQL support after the SQLite-first MVP depends on adoption patterns and team-size feedback.
- Whether to add full English UI localization can be decided after the Japanese-first public MVP is usable.
