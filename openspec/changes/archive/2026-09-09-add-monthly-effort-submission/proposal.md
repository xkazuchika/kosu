## Why

Monthly cost closing currently checks only data that already exists, so the system cannot distinguish an unentered month from an intentionally completed zero-hour month. A lightweight member submission state is needed to make monthly completeness explicit without introducing a multi-step approval workflow.

## What Changes

- Add one member/month effort-submission state with draft and submitted lifecycle states, submitter identity, and submission timestamp.
- Let members explicitly submit their own month, including a valid zero-hour month, after all saved daily work logs are balanced.
- Return a submitted month to draft whenever its protected effort inputs are changed while the workspace month is open.
- Show members their submission state and give administrators a team submission summary with links to incomplete members.
- Treat required-but-unsubmitted member months as monthly-close blockers and recheck them transactionally during approval.
- Define which members require submission for a month so inactive historical members with monthly activity are not silently omitted.

## Capabilities

### New Capabilities

- `monthly-effort-submission`: Member/month submission lifecycle, eligibility, validation, zero-hour submission, and invalidation behavior.

### Modified Capabilities

- `time-entries`: Effort mutations in an open month invalidate an existing monthly submission.
- `dashboard`: Add member and administrator monthly submission status and next actions.
- `project-cost-closing`: Add missing member submissions to completeness blockers and transactional approval checks.

## Impact

- Adds a SQLite table and repository/service APIs for member/month submission state and audit metadata.
- Affects daily entry, weekly entry, monthly bulk entry, daily-plan-to-actual copy, dashboard, and monthly-close completeness/approval.
- Requires migration, service and route tests, dashboard/UI tests, and release/user documentation updates.
- Remains a lightweight completion declaration; it does not add manager approval, rejection, comments, reminders, attendance, leave, or payroll behavior.
