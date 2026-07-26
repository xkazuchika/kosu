## Purpose

Define administrator-only project direct-labor cost, budget consumption, and labor-margin review.

## Requirements

### Requirement: Administrator-only project financial access
The system SHALL restrict project financial inputs, calculations, and reports to administrators.

#### Scenario: Administrator views project financial data
- **WHEN** an administrator opens a project financial input or review screen
- **THEN** the system displays financial amounts and labor-cost calculations allowed by that administrator's access

#### Scenario: Member requests project financial data
- **WHEN** a non-administrator requests a project financial input or review screen
- **THEN** the system denies access and does not include contract revenue, labor budget, cost, or margin values in the response

### Requirement: Separate project financial baseline
The system SHALL allow administrators to record optional tax-exclusive contract revenue and labor cost budget independently for each project.

#### Scenario: Administrator records financial baseline
- **WHEN** an administrator creates or updates a project
- **THEN** the system allows recording contract revenue and labor cost budget as separate non-negative yen amounts

#### Scenario: Legacy amount remains unclassified
- **WHEN** an existing project has only the legacy revenue-or-budget amount
- **THEN** the system preserves the legacy value without treating it as contract revenue or labor cost budget until an administrator records the new values

### Requirement: Labor cost calculations use snapshots
The system SHALL calculate planned and actual labor cost from saved hourly cost rate snapshots rather than current member cost rates.

#### Scenario: Administrator reviews monthly labor costs
- **WHEN** an administrator selects a month in the project financial review
- **THEN** the system calculates planned labor cost from monthly planned hours and actual labor cost from effort allocation hours using their saved cost snapshots

#### Scenario: Historical member cost rate changes
- **WHEN** an administrator changes a member's hourly cost rate after plans or allocations have been saved
- **THEN** the financial review keeps previously saved planned and actual labor cost based on their existing snapshots

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

### Requirement: Project financial review
The system SHALL provide an administrator-only project financial review for budget consumption and labor-margin decisions.

#### Scenario: Administrator reviews an active billable project
- **WHEN** an administrator reviews an active billable project with contract revenue and labor cost budget
- **THEN** the system displays selected-month planned and actual labor cost, cumulative actual labor cost, remaining labor cost budget, labor budget consumption, target labor gross profit, and target labor gross profit rate

#### Scenario: Administrator reviews an archived billable project
- **WHEN** an administrator reviews an archived billable project with complete cost data and contract revenue
- **THEN** the system displays final labor gross profit and final labor gross profit rate based on cumulative actual labor cost

#### Scenario: Administrator reviews a non-revenue project
- **WHEN** an administrator reviews an internal or non-billable project without contract revenue
- **THEN** the system displays applicable labor cost and labor budget information without implying gross-profit values

### Requirement: Financial scope remains direct-labor only
The system SHALL describe its financial metrics as direct-labor cost control rather than accounting profit.

#### Scenario: Administrator views financial metric guidance
- **WHEN** an administrator opens project financial review
- **THEN** the system identifies labor gross profit as excluding procurement, subcontracting, expenses, tax, invoicing, receivables, and payroll

### Requirement: Approved financial views use snapshots
The system SHALL use immutable approval snapshots for approved-month project financial views and live calculations for open or in-review months.

#### Scenario: Administrator views approved financial review
- **WHEN** an administrator opens project financial review for an approved month
- **THEN** the system displays stored project baselines, monthly and cumulative direct-labor costs, budget values, and applicable labor margins from the approval snapshot

#### Scenario: Administrator views open financial review
- **WHEN** an administrator opens project financial review for an open month
- **THEN** the system calculates current values from live plans, allocations, cost snapshots, and project baselines
