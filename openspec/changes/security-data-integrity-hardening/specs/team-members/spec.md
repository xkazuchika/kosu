## ADDED Requirements

### Requirement: Login brute-force protection
The system SHALL mitigate password guessing by equalizing authentication timing across known and unknown emails and by limiting repeated failed login attempts per client.

#### Scenario: Unknown email timing matches known email
- **WHEN** a login request uses an email address that does not exist
- **THEN** the system performs a comparable password hashing workload before responding so that response timing does not reveal whether the account exists

#### Scenario: Repeated failures are throttled
- **WHEN** a client exceeds the threshold of failed login attempts within a time window
- **THEN** the system rejects subsequent login attempts from that client with a throttling response until the window passes

### Requirement: Session invalidation on password change
The system SHALL invalidate sessions for a member when their password is changed.

#### Scenario: Self password change keeps only current session
- **WHEN** a member changes their own password
- **THEN** the system invalidates all sessions issued for that member before the change except the current session

#### Scenario: Administrator password reset ends member sessions
- **WHEN** an administrator changes another member's password
- **THEN** the system invalidates all sessions issued for that member

### Requirement: Last active administrator protection
The system SHALL prevent disabling or demoting the last active administrator account.

#### Scenario: Disabling last active administrator is rejected
- **WHEN** an administrator disables or demotes the only active administrator account
- **THEN** the system rejects the change and keeps the account active with the administrator role

#### Scenario: Demotion succeeds while other administrators remain
- **WHEN** an administrator disables or demotes an account while at least one other active administrator account remains
- **THEN** the system applies the change
