## Requirements

### Requirement: Initial setup state
The system SHALL require initial workspace setup when no administrator account exists.

#### Scenario: Fresh installation opens setup
- **WHEN** a visitor opens the application before any administrator exists
- **THEN** the system displays the initial setup flow instead of the login screen

#### Scenario: Setup is unavailable after administrator creation
- **WHEN** an administrator account already exists
- **THEN** the system prevents access to the initial setup flow

### Requirement: Workspace creation
The system SHALL create a single workspace during initial setup with a display name and default timezone.

#### Scenario: Administrator completes workspace setup
- **WHEN** the setup form is submitted with a workspace name, timezone, administrator name, email, and valid password
- **THEN** the system creates the workspace and first administrator account

#### Scenario: Required setup fields are missing
- **WHEN** the setup form is submitted without required workspace or administrator fields
- **THEN** the system rejects the setup and shows validation errors

### Requirement: Workspace settings
The system SHALL allow administrators to view and update workspace display name and default timezone.

#### Scenario: Administrator updates workspace settings
- **WHEN** an administrator saves a new workspace name or timezone
- **THEN** the system persists the updated workspace settings

#### Scenario: Non-administrator attempts settings update
- **WHEN** a non-administrator attempts to update workspace settings
- **THEN** the system denies the request

### Requirement: Authenticated application access
The system SHALL require authentication for all application pages after initial setup is complete.

#### Scenario: Unauthenticated visitor opens app page
- **WHEN** an unauthenticated visitor opens an application page after setup
- **THEN** the system redirects the visitor to the login screen

#### Scenario: Authenticated member opens app page
- **WHEN** an authenticated member opens an application page
- **THEN** the system displays the requested page according to that member's role
