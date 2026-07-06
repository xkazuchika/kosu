## 1. Application Foundation

- [x] 1.1 Scaffold a React Router / Remix-style TypeScript full-stack web application that supports authenticated server-rendered pages and Docker deployment
- [x] 1.2 Add package scripts for development, build, start, lint, typecheck, Vitest, Playwright, and Drizzle migration commands
- [x] 1.3 Configure formatting, linting, TypeScript strictness, Vitest, and Playwright
- [x] 1.4 Create the base application layout, role-aware navigation shell, error page, loading states, and authenticated route structure
- [x] 1.5 Define the lightweight OSS/business-app visual system for colors, typography, spacing, cards, tables, forms, badges, warnings, and empty states
- [x] 1.6 Configure Tailwind CSS and shadcn/ui-style reusable UI components for layout, forms, tables, cards, badges, dialogs, and toasts
- [x] 1.7 Add MIT license metadata and repository license file
- [x] 1.8 Update `README.md` with Japanese-first local development setup, MVP product summary, screenshots or screenshot placeholders, public OSS usage guidance, and English summary

## 2. Persistence and Domain Model

- [x] 2.1 Add SQLite-backed Drizzle database configuration with a documented data directory path
- [x] 2.2 Define migrations for workspace settings, members, sessions, projects, tasks, project assignments with assignment source, member monthly capacities, monthly plans, daily work logs, effort allocations, period locks, and import jobs
- [x] 2.3 Add database indexes for session lookup, member email, project code, capacity month, plan month, work-log date, lock month, department, role, member, project, and task report filters
- [x] 2.4 Implement typed data-access modules for each domain entity
- [x] 2.5 Add data-access support for cost-rate snapshots on monthly plans and effort allocations
- [x] 2.6 Add unit tests for migration bootstrap and core data-access validation rules

## 3. Workspace Setup and Authentication

- [x] 3.1 Implement setup-state detection that routes fresh installations to initial setup and configured installations to login
- [x] 3.2 Implement initial workspace setup with workspace name, timezone, first administrator account, password hashing, and validation
- [x] 3.3 Implement email/password login with generic invalid-credential errors and inactive-member rejection
- [x] 3.4 Implement secure HTTP-only cookie sessions and logout session invalidation
- [x] 3.5 Protect application pages and server actions with authenticated-member checks
- [x] 3.6 Add tests for setup gating, login success, login failure, logout, and authenticated route protection

## 4. Member and Workspace Administration

- [x] 4.1 Implement workspace settings page for administrators to update display name and default timezone
- [x] 4.2 Implement member list and member create/edit forms for administrators, including department name and hourly cost rate fields
- [x] 4.3 Enforce unique member email, administrator/member roles, active/inactive status, and administrator-only cost-rate visibility
- [x] 4.4 Implement self-profile editing for display name and password without allowing role, department, or cost-rate escalation
- [x] 4.5 Add authorization tests for administrator-only settings, member-management, and cost-rate actions

## 5. Projects, Tasks, Assignments, and Plans

- [x] 5.1 Implement project list and administrator project create/edit/archive flows, including unique project code, project type, client name, and revenue or budget amount
- [x] 5.2 Implement task list and administrator task create/edit/archive flows scoped to projects
- [x] 5.3 Implement administrator project assignment management for active members and active projects, including optional assignment role and assignment source visibility
- [x] 5.4 Implement member self-assignment from existing active project search without allowing project master-data edits
- [x] 5.5 Preserve archived project/task names and removed assignment history while preventing new allocations against unavailable work items
- [x] 5.6 Implement administrator monthly capacity create/update/delete by member and month
- [x] 5.7 Implement administrator monthly planned-effort create/update/delete by member, assigned project, month, and role
- [x] 5.8 Implement member monthly plan view that shows capacity, planned hours, roles, and capacity balance while hiding financial values
- [x] 5.9 Add validation and authorization tests for project, task, administrator assignment, self-assignment, monthly-capacity, and monthly-plan behavior

## 6. Period Locking

- [x] 6.1 Implement administrator month lock and unlock actions with lock metadata
- [x] 6.2 Prevent non-administrator changes to monthly capacities, monthly plans, daily work logs, and allocations in locked months
- [x] 6.3 Show locked/open status on monthly planning, daily work-log, and report screens
- [x] 6.4 Allow administrator corrections in locked months according to administrator permissions
- [x] 6.5 Add authorization and validation tests for lock, unlock, and locked-period edit behavior

## 7. Daily Work Logs and Allocations

- [x] 7.1 Implement daily work-log creation and editing with work date and total working hours
- [x] 7.2 Implement allocation entry under a daily work log for assigned active projects, optional tasks, allocated hours, and notes
- [x] 7.3 Display allocated total, unallocated or overallocated difference, and warnings without blocking valid partial saves
- [x] 7.4 Validate total working hours and allocated hours in 0.25 hour increments
- [x] 7.5 Hide cost rates, project revenue, allocation cost, and gross profit from non-administrator entry screens
- [x] 7.6 Implement editing and deletion of own work logs and allocations, plus administrator editing and deletion of any member's records
- [x] 7.7 Capture hourly cost-rate snapshots when monthly plans and allocations are created or updated
- [x] 7.8 Respect locked-month rules when creating, editing, or deleting work logs and allocations
- [x] 7.9 Make the daily work-log screen usable on mobile-sized viewports for core date, total-hours, project, allocated-hours, and save controls
- [x] 7.10 Add validation and authorization tests for daily work-log, self-assigned project allocation, time increment, and allocation behavior

## 8. Dashboard

- [x] 8.1 Implement member dashboard with today's input status, current-month planned/actual summaries, allocation warnings, and assigned projects
- [x] 8.2 Implement administrator dashboard with team input status, incomplete allocations, self-assigned project alerts, overplanned members, project summaries, locked-period status, and financial summaries
- [x] 8.3 Add dashboard empty states for no projects, no assignments, and no current-month data
- [x] 8.4 Link dashboard summary cards to the relevant filtered work-log, planning, and report screens
- [x] 8.5 Apply the shared visual system to dashboard cards, status badges, warnings, and administrator-only financial summaries
- [x] 8.6 Add dashboard authorization tests for member-visible and administrator-only data

## 9. Reports and CSV Export

- [x] 9.1 Implement report filters for date range or month, department, role, member, project, project type, and task
- [x] 9.2 Implement administrator team reports grouped by department, member, role, project, project type, task, and day
- [x] 9.3 Implement planned-versus-actual reports by member, role, project, department, and month
- [x] 9.4 Implement resource planning reports with capacity, planned hours, unallocated capacity, and overplanned hours
- [x] 9.5 Implement administrator-only financial reports with project revenue or budget, planned cost, actual cost, and gross profit
- [x] 9.6 Implement member reports limited to the signed-in member's own effort and planned-versus-actual values without financial columns
- [x] 9.7 Implement allocation completeness reporting for unallocated or overallocated daily work logs
- [x] 9.8 Implement empty report states when filters match no entries
- [x] 9.9 Implement CSV export for the current report filters with role-appropriate data visibility
- [x] 9.10 Visually separate financial columns from operational effort columns in administrator reports
- [x] 9.11 Add report aggregation and CSV export tests, including deleted-allocation exclusion, capacity variance, project-type filtering, and financial-column authorization

## 10. Data Import and Export

- [x] 10.1 Implement downloadable CSV templates for members, projects, assignments, monthly capacities, and monthly plans
- [x] 10.2 Implement CSV upload parsing and row-level validation preview without committing rows
- [x] 10.3 Implement confirmed imports for members keyed by email and projects keyed by project code
- [x] 10.4 Implement confirmed imports for project assignments, monthly capacities, and monthly plans using stable member email and project code references
- [x] 10.5 Implement administrative CSV export for members, projects, assignments, monthly capacities, and monthly plans
- [x] 10.6 Add import/export authorization tests and validation tests for duplicate keys, invalid references, and invalid values

## 11. Self-Hosting and Release Readiness

- [x] 11.1 Add production configuration validation with clear errors for missing required secrets
- [x] 11.2 Add Dockerfile and container startup path for the selected web framework
- [x] 11.3 Add example container deployment configuration with a mounted persistent data directory
- [x] 11.4 Document backup and restore guidance for the SQLite database and persistent data directory
- [x] 11.5 Add a documented demo seed command with safeguards against accidental production seeding
- [x] 11.6 Add public repository documentation covering purpose, features, local run, Docker deployment, screenshots or screenshot placeholders, and backup guidance
- [x] 11.7 Run lint, typecheck, unit tests, and build; fix failures before marking implementation complete
- [x] 11.8 Validate all OpenSpec requirements are covered by tests or documented manual verification steps
