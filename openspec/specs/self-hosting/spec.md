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

### Requirement: Guided Windows installation without Docker

The system SHALL provide a documented Windows x64 installation path using a supported Node.js runtime without requiring Docker, Git, or a separately installed database server. The installation entry SHALL check prerequisites, prepare the application, and report failures with an actionable Japanese message before presenting installation as successful.

#### Scenario: First installation from an extracted archive

- **WHEN** a Windows user extracts a supported release archive, has a supported Node.js runtime, and runs the installation entry
- **THEN** the application installs its locked dependencies, prepares its runnable build, and prepares the selected persistent database
- **AND** the user can continue to the documented startup entry without installing Docker or Git

#### Scenario: Missing or unsupported runtime

- **WHEN** a user runs the Windows installation entry without a supported Node.js runtime
- **THEN** it identifies the required runtime and provides the next step
- **AND** it does not claim a successful installation or modify existing application data

#### Scenario: Path contains spaces or Japanese characters

- **WHEN** a supported installation is placed in a writable folder containing spaces or Japanese characters
- **THEN** its documented installation and startup entries resolve the application, configuration, and data paths correctly

### Requirement: Repeatable installation configuration

The system SHALL provide installation configuration that generates and persists a unique session secret of at least 32 characters for a new installation, loads the same selected configuration for preparation and startup, and preserves existing valid configuration and application data on subsequent runs. Secret values SHALL NOT be included in installation output or agent completion reports.

#### Scenario: New configuration

- **WHEN** installation begins without an existing configuration file
- **THEN** the system creates the required configuration with a newly generated session secret and a documented data location
- **AND** preparation and startup use that configuration

#### Scenario: Existing installation is prepared again

- **WHEN** a user repeats installation preparation with valid configuration and existing application data
- **THEN** the existing secret, data location, workspace, and recorded data are retained
- **AND** the process does not recreate administrator accounts or load demo data

#### Scenario: Invalid existing configuration

- **WHEN** an existing configuration contains an invalid secret, a sample placeholder secret, or an unusable data location
- **THEN** preparation reports the relevant configuration problem and its resolution
- **AND** it does not silently replace the existing configuration or switch to another data location

### Requirement: Verified local application startup

The system SHALL provide a Windows startup entry for a prepared application that runs the built application, defaults to loopback access, applies required migrations with the existing integrity checks, and reports readiness only after its own server is running and its health check succeeds. The documented local URL SHALL support setup, login, and authenticated use with the existing session protections.

#### Scenario: Fresh local startup

- **WHEN** a prepared Windows installation starts against fresh data
- **THEN** the user receives a working local URL leading to initial setup
- **AND** completing setup permits authenticated application use

#### Scenario: Restart with existing data

- **WHEN** the application is stopped and started again using the same configuration and data location
- **THEN** the existing workspace and recorded data remain available and the login flow works

#### Scenario: Startup fails or the port is occupied

- **WHEN** migration, integrity checking, server startup, or readiness checking fails, or the selected port is already occupied
- **THEN** startup reports the failing step without announcing a ready application
- **AND** it does not terminate an unrelated process or mistake another service for the started application

### Requirement: Agent installation from public or local sources

The system SHALL provide copyable agent prompts and an agent-facing installation guide for both a public repository URL and an already acquired local folder. The public-URL prompt SHALL instruct the agent to acquire an identified stable release using Git when available or a release source archive otherwise, check that the selected release includes the required installation guide, and follow the same installation and startup entries as manual users. Installation instructions SHALL respect the user's selected method and environment restrictions.

#### Scenario: Agent starts with only a public repository URL

- **WHEN** a user provides the public-URL installation prompt to an agent with the required file, network, and command capabilities
- **THEN** the prompt guides the agent to identify a stable release, acquire it into a new destination, read its installation guide, prepare configuration, and start and verify the application
- **AND** the agent completion report identifies the selected version, method, access URL, data location, and stop and restart procedures

#### Scenario: Git is unavailable

- **WHEN** the agent acquires a release on a machine without Git
- **THEN** the guide provides an archive download and extraction path for the same identified release
- **AND** the agent does not require Git solely to perform installation

#### Scenario: Repository is already acquired

- **WHEN** a user provides the local-folder prompt in an existing clone or extracted archive
- **THEN** the prompt guides the agent to use that folder and its installation guide without replacing it with another download
- **AND** existing configuration and data are preserved

#### Scenario: Stable release lacks the installation entries

- **WHEN** the selected stable release does not contain the guide or startup entries required by the prompt
- **THEN** the instructions direct the agent to report the version mismatch and an available next step
- **AND** the agent does not silently switch to an unreleased main branch or announce successful installation

#### Scenario: Docker is prohibited or execution is blocked

- **WHEN** Docker is unavailable or prohibited, or required installation operations cannot be executed in the environment
- **THEN** the instructions direct the agent to use an allowed documented method or identify the blocking prerequisite and hand off the remaining manual steps
- **AND** they do not direct the agent to change organization restrictions or report an unverified server as running

### Requirement: Common installation and operating guidance

The system SHALL provide manual and agent installation paths that share the application preparation and startup behavior, and SHALL document stop, restart, update, backup, and restore procedures for Windows direct installation and Docker deployment. Update and restore guidance SHALL preserve the selected data location, account for SQLite write-ahead logging, and identify the application version paired with a backup.

#### Scenario: User chooses a manual installation

- **WHEN** a visitor chooses manual installation from the README
- **THEN** the documentation identifies prerequisites, download or clone steps, configuration, preparation, startup, and the browser URL for Windows direct installation and Docker deployment
- **AND** the visitor does not need an agent to complete the procedure

#### Scenario: Operator updates an initialized installation

- **WHEN** an operator follows the update procedure
- **THEN** the procedure directs them to stop writes, create and verify a consistent backup, retain the configuration and data location, and apply the selected application version and migrations
- **AND** it explains that a schema-changing rollback requires a compatible application and database backup

#### Scenario: Operator backs up and restores data

- **WHEN** an operator follows the documented backup and restore procedure
- **THEN** the procedure uses a consistent database backup or stopped application data, verifies the restored database, and retains the previous data until successful verification
- **AND** it does not copy a live SQLite database as ordinary files or reuse stale write-ahead logging side files with a replaced database

### Requirement: Installation discovery in public documentation

The system SHALL present both agent-assisted and manual installation choices near the beginning of the README. The agent choice SHALL include separately labeled prompts for public-URL and local-folder entry, explain the capabilities needed by the agent, and refer to the installation guides shipped with the corresponding supported release.

#### Scenario: Visitor chooses agent-assisted installation

- **WHEN** a visitor opens the README without having downloaded kosu
- **THEN** the visitor can find and copy a prompt containing the public repository URL and instructions to acquire and run a supported release
- **AND** the same section links to the manual installation alternatives

#### Scenario: Visitor already downloaded kosu

- **WHEN** a visitor has an existing repository folder
- **THEN** the README identifies the local-folder prompt separately from the acquisition prompt
- **AND** neither prompt requires registration of a provider-specific skill
