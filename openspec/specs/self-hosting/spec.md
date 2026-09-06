## Purpose

Define self-hosting, deployment, and local data persistence expectations for kosu.

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
The system SHALL apply database migrations safely during application startup or an explicit migration command, and SHALL verify foreign key integrity after migrating.

#### Scenario: Fresh database migration
- **WHEN** the application starts against an empty database
- **THEN** the system creates the schema required for the MVP

#### Scenario: Existing database is current
- **WHEN** the application starts against a database with current migrations applied
- **THEN** the system starts without modifying data unexpectedly

#### Scenario: Migration leaves orphaned rows
- **WHEN** the application completes migrations and orphaned rows exist
- **THEN** the system reports the violation and stops before serving requests

### Requirement: Backup guidance
The system SHALL document backup and restore guidance for the persistent data directory that avoids copying live SQLite database files and accounts for write-ahead logging side files.

#### Scenario: Operator reads backup documentation
- **WHEN** an operator opens the deployment documentation
- **THEN** the documentation identifies which directory or files must be backed up, names the write-ahead logging side files as part of the database, and instructs the operator to stop the application or run a consistent SQLite backup command instead of copying files while the application is running

#### Scenario: Operator follows safe backup procedure
- **WHEN** an operator stops the application or runs the documented consistent backup command
- **THEN** the resulting backup can be restored without database corruption risk from a partially written database file

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

### Requirement: Database connection integrity
The system SHALL enable foreign key enforcement, write-ahead logging, and a busy timeout on every SQLite connection it opens.

#### Scenario: Connection enforces foreign keys
- **WHEN** the application opens a SQLite connection
- **THEN** foreign key constraints declared in the schema are enforced for writes on that connection

#### Scenario: Write conflict is retried instead of failing immediately
- **WHEN** a write encounters a locked database
- **THEN** the system waits for the configured busy timeout before returning an error

#### Scenario: Concurrent readers do not block on a writer
- **WHEN** one request writes while another reads
- **THEN** the reader proceeds without waiting for the writer to finish because write-ahead logging is enabled

### Requirement: Foreign key readiness check
The system SHALL verify existing data against foreign key constraints before enabling enforcement and refuse to start when orphaned rows exist.

#### Scenario: Existing data is consistent
- **WHEN** the application starts and no orphaned rows violate foreign key constraints
- **THEN** the system starts normally with foreign key enforcement enabled

#### Scenario: Orphaned rows exist
- **WHEN** the application starts and rows violate foreign key constraints
- **THEN** the system refuses to start and reports the affected tables and row counts with guidance to repair the data from a backup

### Requirement: Operational health endpoint
The system SHALL expose an unauthenticated health endpoint that reports whether the application and its database connection are usable.

#### Scenario: Health check succeeds
- **WHEN** a monitoring client requests the health endpoint and the database connection is usable
- **THEN** the system responds with a success status

#### Scenario: Health check fails
- **WHEN** a monitoring client requests the health endpoint and the database connection is not usable
- **THEN** the system responds with an error status

#### Scenario: Health response avoids internal detail
- **WHEN** any client requests the health endpoint
- **THEN** the response contains only availability state and no member, project, or financial data

### Requirement: Operational event logging
The system SHALL record security-relevant and failure events to standard output for operator troubleshooting.

#### Scenario: Failed sign-in is recorded
- **WHEN** a sign-in attempt fails or is rate limited
- **THEN** the system records the event with the attempted identifier context and the reason

#### Scenario: Authorization rejection is recorded
- **WHEN** a request is denied because the member lacks the required role or the month is protected
- **THEN** the system records the event with the route context and the denial reason

#### Scenario: Action failure is recorded
- **WHEN** a route action throws an unhandled error
- **THEN** the system records the error with its message before returning a generic response to the user

#### Scenario: Monthly close action is recorded
- **WHEN** an administrator enters review, approves, reopens, or corrects a monthly close
- **THEN** the system records the action with the target month and acting member

#### Scenario: Credentials are not written to logs
- **WHEN** the system records any event
- **THEN** the record excludes passwords, password hashes, session identifiers, and hourly cost rates
