## MODIFIED Requirements

### Requirement: Incomplete cost data is visible
The system SHALL not treat work without a saved cost snapshot, unbalanced work logs, or missing required billable-project baselines as zero-cost inputs in financial decision metrics.

#### Scenario: Financial review contains missing cost snapshots
- **WHEN** monthly planned hours, selected-month actual hours, or historically relevant actual hours lack a cost snapshot
- **THEN** the system identifies affected records and hours, marks live financial totals incomplete, and blocks monthly approval

#### Scenario: Financial review contains unbalanced work logs
- **WHEN** the selected workspace month contains a work log whose allocation total differs from total working hours
- **THEN** the system identifies the member and date and blocks monthly approval

#### Scenario: Billable active project lacks required baseline
- **WHEN** a billable project has planned or actual activity in the selected month but lacks contract revenue or labor cost budget
- **THEN** the system identifies the missing values and blocks monthly approval

#### Scenario: Non-billable project lacks revenue
- **WHEN** an internal or non-billable project has activity without contract revenue
- **THEN** the system permits labor-cost review without treating missing revenue as an issue

## ADDED Requirements

### Requirement: Approved financial views use snapshots
The system SHALL use immutable approval snapshots for approved-month project financial views and live calculations for open or in-review months.

#### Scenario: Administrator views approved financial review
- **WHEN** an administrator opens project financial review for an approved month
- **THEN** the system displays stored project baselines, monthly and cumulative direct-labor costs, budget values, and applicable labor margins from the approval snapshot

#### Scenario: Administrator views open financial review
- **WHEN** an administrator opens project financial review for an open month
- **THEN** the system calculates current values from live plans, allocations, cost snapshots, and project baselines
