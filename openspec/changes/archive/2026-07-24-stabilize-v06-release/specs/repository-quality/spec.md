## ADDED Requirements

### Requirement: Pull Request quality gate
The repository SHALL run repeatable automated quality checks for each Pull Request using the committed lockfile and supported Node.js version.

#### Scenario: Pull Request checks succeed
- **WHEN** a Pull Request passes dependency installation, Vitest, typecheck, ESLint, and production build
- **THEN** GitHub Actions reports a successful quality-gate check

#### Scenario: Quality command fails
- **WHEN** any required quality command exits unsuccessfully
- **THEN** GitHub Actions reports a failed check identifying the failing job

### Requirement: Browser smoke coverage
The repository SHALL contain a Playwright smoke suite that verifies the minimum deployable authentication flow against an isolated database.

#### Scenario: Fresh installation smoke succeeds
- **WHEN** Playwright starts the application with a fresh test data directory and valid test configuration
- **THEN** the suite completes initial setup, reaches login, authenticates, and opens the dashboard

#### Scenario: No browser tests are discovered
- **WHEN** the configured E2E command discovers zero Playwright tests
- **THEN** the command exits unsuccessfully rather than being treated as passing verification

#### Scenario: Pull Request browser smoke fails
- **WHEN** the application cannot start or the setup and login flow regresses
- **THEN** GitHub Actions reports a failed browser-smoke check with Playwright diagnostic artifacts

### Requirement: Current release verification
The repository SHALL provide a version-neutral release checklist whose verification claims correspond to commands and deployment smoke checks executed for the candidate being released.

#### Scenario: Maintainer prepares a release
- **WHEN** a maintainer follows the release checklist
- **THEN** the checklist covers automated quality commands, database migration, container startup, setup or login reachability, SQLite persistence, and dependency audit review

#### Scenario: Verification has not been executed
- **WHEN** a candidate-specific check has not been run
- **THEN** the documentation does not mark that check as successfully verified

### Requirement: Dependency audit classification
The release process SHALL distinguish production dependency vulnerabilities from development-toolchain advisories.

#### Scenario: Production audit is clean
- **WHEN** `npm audit --omit=dev` reports no vulnerability
- **THEN** the release record identifies the production dependency audit as clean

#### Scenario: Development advisory has no safe compatible fix
- **WHEN** the full dependency audit reports a development-tool advisory whose proposed fix is an incompatible downgrade
- **THEN** the release record documents the accepted risk without applying a forced breaking fix
