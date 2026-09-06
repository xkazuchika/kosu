## MODIFIED Requirements

### Requirement: Backup guidance
The system SHALL document backup and restore guidance for the persistent data directory that avoids copying live SQLite database files.

#### Scenario: Operator reads backup documentation
- **WHEN** an operator opens the deployment documentation
- **THEN** the documentation identifies which directory or files must be backed up and instructs the operator to stop the application or run a consistent SQLite backup command instead of copying files while the application is running

#### Scenario: Operator follows safe backup procedure
- **WHEN** an operator stops the application or runs the documented consistent backup command
- **THEN** the resulting backup can be restored without database corruption risk from a partially written database file
