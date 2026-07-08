## Context

v0.2 added monthly bulk actual entry and planned-versus-actual reporting. During hands-on use, the planning UI still felt confusing because it asks for member capacity before the user's actual goal: entering planned hours for people on projects. The existing schema already supports the core project-plan data, so v0.3 can improve the workflow without a migration.

## Goals / Non-Goals

**v0.3 Scope:**

- Redesign monthly planning so administrators enter project planned effort first.
- Treat member capacity as optional context rather than required setup.
- Show existing monthly project plans on the planning screen.
- Allow existing monthly project plans to be updated or deleted.
- Keep planned-versus-actual reports useful even when capacity is not set.

**Goals:**

- Make monthly project planned effort the primary planning workflow.
- Keep capacity as optional context, not a required planning input.
- Make existing project plans visible, editable, and deletable from the planning screen.
- Keep planned-versus-actual useful even when capacity is missing.
- Preserve the existing monthly plan table and uniqueness rule.

**Non-Goals:**

- Add日別配賦予定 or planned allocation templates in this change.
- Remove the capacity table or existing capacity data.
- Add financial reporting or profitability views.
- Add a new scheduling/calendar data model.
- Add attendance, payroll, invoicing, expenses, approval workflows, or enterprise ERP features.

## Decisions

### Keep existing monthly plan schema

The monthly plan table already models `memberId`, `projectId`, `month`, `assignmentRole`, and `plannedHours`, which is the data users need for project-level planning. v0.3 should improve the screens and behavior rather than adding new tables.

Alternative considered: create a separate planning model for project plans. This would duplicate existing data and complicate planned-versus-actual reporting.

### Treat capacity as optional context

Capacity remains useful for teams that want under/over planning signals, but it should not be a prerequisite. The primary admin planning screen should lead with project planned effort and move capacity to a secondary section.

Alternative considered: remove capacity entirely. This would simplify the UI but throw away useful current behavior and existing data.

### Make monthly plans editable in place

Users need to correct a planned-hours value after creating it. The existing duplicate-upsert behavior is technically valid, but it is not discoverable. The UI should show existing plan rows with edit/delete controls.

Alternative considered: keep create-only forms and rely on uniqueness upsert. That keeps code small but preserves the confusion.

### Use project-cost management as a direction, not a broad suite

Project-cost management products validate the product direction: project plans, daily effort, planned-versus-actual, project budgets, labor cost, and profitability are useful for software development teams. Kosu should adopt the lightweight parts that support self-hosted effort and profitability visibility, but avoid becoming a broad ERP or back-office suite.

Near-term target areas:

- Daily allocation plans that can be copied into actual effort.
- Project/month revenue and cost-budget records.
- Planned cost and actual cost from hourly cost-rate snapshots.
- Project/month gross-profit and variance reports.
- CSV export for operational and financial summaries.

Explicitly deferred areas:

- Attendance and payroll management.
- Invoicing and receivables management.
- Expense reimbursement.
- Approval workflow and audit-heavy governance.
- External SaaS integrations, ticket sync, or full project-management replacement.

These target areas are intentionally not part of v0.3 implementation. They should become separate OpenSpec changes after the v0.3 monthly planning workflow is settled.

## Risks / Trade-offs

- Capacity becoming secondary could hide useful overplanning signals -> Keep summary cards when capacity exists and label them as optional capacity context.
- Existing tests may assume capacity is always part of planning -> Update tests to assert planning works without capacity.
- Editing existing plan rows inside a table can get cramped on mobile -> Use compact controls and retain the add form for new plans.
- Project-cost management scope could sprawl quickly -> Keep each future capability behind a focused OpenSpec change and preserve the lightweight self-hosted positioning.
