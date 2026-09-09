## ADDED Requirements

### Requirement: Monthly submissions gate cost review and approval
The system SHALL treat every required member/month submission that remains draft as a blocking completeness issue and SHALL not start review or approve until a fresh transactional check finds all required submissions complete.

#### Scenario: Draft member blocks review start
- **WHEN** an administrator attempts to move an open month to in-review while one or more required member submissions remain draft
- **THEN** the system leaves the month open and displays blocking issues with links to the affected member/month reviews

#### Scenario: All required members submitted
- **WHEN** every required member has submitted and the administrator starts review
- **THEN** the system transitions the month to in-review atomically with a fresh submission check

#### Scenario: Approval rechecks submissions
- **WHEN** an administrator approves an in-review month
- **THEN** the transactional completeness check includes required submission state before saving snapshots and approval

#### Scenario: Reopened month retains submission state until effort changes
- **WHEN** an administrator reopens a protected month without changing actual effort
- **THEN** existing member submissions remain submitted, and a later actual-effort write invalidates only the affected member/month
