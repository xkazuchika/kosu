## Requirements

### Requirement: Local member accounts
The system SHALL support local member accounts with name, email address, password credential, role, active status, optional department name, and administrator-only hourly cost rate.

#### Scenario: Administrator creates member
- **WHEN** an administrator creates a member with name, unique email, role, temporary password, optional department name, and optional hourly cost rate
- **THEN** the system stores the member account and allows that member to sign in

#### Scenario: Duplicate email is rejected
- **WHEN** an administrator creates or updates a member using an email already assigned to another member
- **THEN** the system rejects the request

### Requirement: Password login
The system SHALL authenticate active members using email and password.

#### Scenario: Valid login succeeds
- **WHEN** an active member submits a valid email and password
- **THEN** the system creates a session and opens the application

#### Scenario: Invalid login fails
- **WHEN** a login request has an unknown email, wrong password, or inactive member
- **THEN** the system rejects the login without revealing which field was incorrect

### Requirement: Session logout
The system SHALL allow authenticated members to end their current session.

#### Scenario: Member logs out
- **WHEN** an authenticated member chooses logout
- **THEN** the system invalidates the current session and returns the member to the login screen

### Requirement: Member roles
The system SHALL provide administrator and member roles.

#### Scenario: Administrator manages members
- **WHEN** an administrator opens member management
- **THEN** the system allows creating, editing, activating, and deactivating member accounts

#### Scenario: Member cannot manage members
- **WHEN** a non-administrator attempts to manage member accounts
- **THEN** the system denies the request

### Requirement: Cost rate visibility
The system SHALL restrict member hourly cost rates to administrators.

#### Scenario: Administrator views cost rate
- **WHEN** an administrator opens member management
- **THEN** the system displays and allows editing of member hourly cost rates

#### Scenario: Member cannot view cost rate
- **WHEN** a non-administrator opens their own profile or time-entry screen
- **THEN** the system does not display hourly cost rate fields or derived cost values

### Requirement: Self profile
The system SHALL allow authenticated members to update their own display name and password.

#### Scenario: Member updates own profile
- **WHEN** a member saves a new display name or valid new password for their own account
- **THEN** the system persists the profile change

#### Scenario: Member attempts role escalation
- **WHEN** a non-administrator attempts to change their own role
- **THEN** the system denies the request

#### Scenario: Member attempts cost update
- **WHEN** a non-administrator attempts to change their own department or hourly cost rate
- **THEN** the system denies the request
