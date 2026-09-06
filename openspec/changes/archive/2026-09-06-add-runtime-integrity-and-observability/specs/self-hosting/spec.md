## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Backup guidance
The system SHALL document backup and restore guidance for the persistent data directory that avoids copying live SQLite database files and accounts for write-ahead logging side files.

#### Scenario: Operator reads backup documentation
- **WHEN** an operator opens the deployment documentation
- **THEN** the documentation identifies which directory or files must be backed up, names the write-ahead logging side files as part of the database, and instructs the operator to stop the application or run a consistent SQLite backup command instead of copying files while the application is running

#### Scenario: Operator follows safe backup procedure
- **WHEN** an operator stops the application or runs the documented consistent backup command
- **THEN** the resulting backup can be restored without database corruption risk from a partially written database file

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
