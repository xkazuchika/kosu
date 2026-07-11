## MODIFIED Requirements

### Requirement: Profitability reporting roadmap boundary
The system SHALL provide administrator-only project financial review that compares contract revenue and labor cost budget with planned and actual direct-labor cost, while preserving the existing planned-versus-actual effort report as a non-financial report.

#### Scenario: Administrator views project financial review
- **WHEN** an administrator opens project financial review for a selected month
- **THEN** the system displays project/month planned and actual labor cost together with project-level contract revenue, labor cost budget, cumulative actual labor cost, and applicable labor-margin metrics

#### Scenario: Existing planned-versus-actual remains non-financial
- **WHEN** a user opens the existing planned-versus-actual effort report
- **THEN** the system does not display revenue, budget, cost, gross profit, or profitability values

#### Scenario: Project financial review avoids accounting scope
- **WHEN** an administrator uses project financial review
- **THEN** the system keeps the scope to direct-labor cost control and does not add invoicing, accounting ledger, payment collection, or tax calculation features
