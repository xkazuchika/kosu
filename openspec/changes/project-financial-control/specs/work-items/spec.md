## MODIFIED Requirements

### Requirement: Project financial planning roadmap boundary
The system SHALL support administrator-managed project contract revenue, labor cost budget, planned labor cost, actual labor cost, and direct-labor margin visibility for project tracking.

#### Scenario: Administrator configures project financial baseline
- **WHEN** an administrator creates or updates a project
- **THEN** the system allows separate optional contract revenue and labor cost budget records before financial review

#### Scenario: Project financial scope stays lightweight
- **WHEN** project financial planning is used
- **THEN** the system excludes invoicing, receivables, expense reimbursement, payroll, tax calculation, procurement, subcontractor cost, and ERP workflow from the scope
