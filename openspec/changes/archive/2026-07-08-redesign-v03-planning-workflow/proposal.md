## Why

The v0.2 planning workflow still exposes member capacity entry as a primary input, but users are looking for a simpler way to enter project-level planned effort. v0.3 should make monthly planning feel like assigning planned hours to people and projects, while treating capacity as optional context rather than a required first step.

## What Changes

- Rework monthly planning around project planned effort entries: member, project, optional assignment role, month, and planned hours.
- Move member capacity entry out of the primary monthly planning flow and present it as optional capacity context.
- Add clearer list/edit/delete behavior for existing monthly project plans so planned hours can be corrected without creating duplicate confusion.
- Update planned-versus-actual and planning copy to avoid implying that member capacity is required to use planning.
- Keep日別配賦予定 out of this change; leave it as a future planning enhancement after the monthly planning model is easier to use.
- Document the roadmap boundary: project planning, actual effort, project/month budgets, and profitability are future target areas, while attendance, payroll, invoicing, expenses, approvals, and enterprise workflow remain out of near-term scope.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `monthly-plans`: Redesign monthly planning requirements around project planned effort and optional capacity context.
- `reports`: Clarify planned-versus-actual behavior when capacity is missing and keep comparison useful from project plans alone.
- `ui-ux`: Update navigation and wording requirements for the v0.3 planning workflow.
- `work-items`: Clarify future project/month budget direction without adding it to v0.3 implementation.
- `time-entries`: Clarify future daily allocation plan direction without adding it to v0.3 implementation.

## Impact

- Affected routes: `app/routes/monthly-plans.tsx`, `app/routes/monthly-plans.admin.tsx`, and `app/routes/reports.planned-vs-actual.tsx`.
- Affected tests: monthly plans route tests, report tests, and navigation/component tests.
- Data model: no schema migration expected; reuse existing monthly plan and capacity tables.
- OpenSpec: update current specs so capacity becomes optional context and project planned effort is the primary planning unit.
- Roadmap: future specs should favor lightweight project/month budget and profitability visibility over ERP, attendance, payroll, invoicing, or approval workflow features.
