## Why

v0.3 made monthly planned effort easier to enter, but monthly totals do not answer the operational question of when a member is expected to work on each project. Teams need a daily planning layer that captures planned project allocation by date and can safely seed actual effort entries.

## What Changes

- Add daily allocation plans as a project-level planning layer: member, project, plan date, and planned hours.
- Provide a horizontal monthly input workflow where rows are dates, columns are assigned projects, and cells are planned hours.
- Treat empty or `0` cells as no plan: existing rows are deleted, and only positive planned hours are stored.
- Validate planned hours using positive 0.25h increments and enforce a maximum 24h daily planned total per member.
- Allow members to edit only their own daily plans and administrators to edit any member's daily plans.
- Allow projects from the member's active assignments, including projects that do not have monthly plans.
- Compare daily plan totals with monthly planned effort by aggregation only; do not link daily plans to monthly plan rows.
- Add a safe copy action from daily plans to actual daily work logs and effort allocations for days with no existing actual allocations.
- Keep task-level planning, planned cost snapshots, workspace scoping, financial reporting, and changes to the existing planned-versus-actual report source out of this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `time-entries`: Add daily allocation plan storage, validation, editing, lock handling, and copy-to-actual behavior.
- `monthly-plans`: Clarify that monthly plans are monthly totals and daily plans compare by aggregation without direct linkage.
- `ui-ux`: Add requirements for horizontal daily allocation plan input and mobile fallback behavior.
- `reports`: Clarify that existing planned-versus-actual reports continue to use monthly plans in this change.

## Impact

- Database: add `daily_allocation_plans` table with a unique constraint on member, date, and project.
- Routes: add daily plan monthly input and copy-to-actual actions; update navigation to expose the workflow.
- Repositories/services: add CRUD, aggregation, validation, and copy-to-actual logic.
- Tests: add repository, route, validation, permission, lock, and copy-to-actual regression tests.
- OpenSpec: update main specs after implementation and archive this change when complete.
