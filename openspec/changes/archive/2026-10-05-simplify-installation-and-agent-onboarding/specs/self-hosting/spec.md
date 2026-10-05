## ADDED Requirements

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
