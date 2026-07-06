## Requirements

### Requirement: Containerized deployment
The system SHALL provide a documented containerized deployment path for a single self-hosted instance.

#### Scenario: Operator starts default deployment
- **WHEN** an operator starts the documented container deployment with required environment variables and a mounted data directory
- **THEN** the application starts and serves the initial setup or login screen

### Requirement: Persistent application data
The system SHALL store durable application data in a documented persistent data directory.

#### Scenario: Container restarts
- **WHEN** the application container restarts with the same mounted data directory
- **THEN** workspace, member, project, task, assignment, monthly-capacity, monthly-plan, daily-work-log, allocation, period-lock, import-job, and session data remains available

### Requirement: Runtime configuration
The system SHALL document required and optional runtime configuration for self-hosted operation.

#### Scenario: Required secret is missing
- **WHEN** the application starts without a required production secret
- **THEN** the system fails startup with a clear configuration error

#### Scenario: Optional configuration is omitted
- **WHEN** optional configuration is omitted
- **THEN** the system uses documented safe defaults

### Requirement: Database migrations
The system SHALL apply database migrations safely during application startup or an explicit migration command.

#### Scenario: Fresh database migration
- **WHEN** the application starts against an empty database
- **THEN** the system creates the schema required for the MVP

#### Scenario: Existing database is current
- **WHEN** the application starts against a database with current migrations applied
- **THEN** the system starts without modifying data unexpectedly

### Requirement: Backup guidance
The system SHALL document backup and restore guidance for the persistent data directory.

#### Scenario: Operator reads backup documentation
- **WHEN** an operator opens the deployment documentation
- **THEN** the documentation identifies which directory or files must be backed up to restore the installation

### Requirement: Public repository documentation
The system SHALL include documentation suitable for a public GitHub repository.

#### Scenario: Visitor reads README
- **WHEN** a visitor opens the repository README
- **THEN** the documentation explains what kosu does, who it is for, how to run it locally, how to deploy it with Docker, and how to back up data

#### Scenario: Visitor reviews screenshots
- **WHEN** a visitor opens the repository README or documentation
- **THEN** the documentation includes screenshots or screenshot placeholders for dashboard, effort entry, planning, and reports

### Requirement: Demo seed data
The system SHALL provide a documented way to create demo data for trial usage.

#### Scenario: Operator loads demo data
- **WHEN** an operator runs the documented demo seed command against a non-production database
- **THEN** the system creates sample members, projects, assignments, capacities, plans, work logs, and allocations

#### Scenario: Demo seed is blocked in production
- **WHEN** an operator attempts to load demo data in production mode
- **THEN** the system refuses unless an explicit documented override is provided
