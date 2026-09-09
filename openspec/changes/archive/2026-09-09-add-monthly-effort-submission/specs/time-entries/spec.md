## ADDED Requirements

### Requirement: Actual effort writes invalidate monthly submission
The system SHALL return the target member/month submission to draft in the same transaction as any successful write that creates, updates, deletes, clears, reactivates, or copies actual work logs or effort allocations.

#### Scenario: Daily effort write invalidates submission
- **WHEN** a daily unified save, total-hours save, allocation deletion, or previous-day copy succeeds for a submitted member/month
- **THEN** the target member/month becomes draft atomically with the effort change

#### Scenario: Weekly or monthly bulk write invalidates submission
- **WHEN** weekly entry or monthly total-hours entry successfully changes one or more dates in a submitted member/month
- **THEN** that member/month becomes draft atomically and other months in the same request are invalidated only when they receive successful writes

#### Scenario: Planned-to-actual copy invalidates submission
- **WHEN** copying daily plans creates or updates actual effort in a submitted member/month
- **THEN** the target member/month becomes draft in the copy transaction

#### Scenario: Planned effort alone does not invalidate submission
- **WHEN** a user changes a daily plan, monthly plan, or capacity without creating or changing actual effort
- **THEN** the actual-effort submission state remains unchanged

#### Scenario: Rejected effort write preserves submission
- **WHEN** an effort write is rejected by validation, authorization, or monthly-close protection
- **THEN** the target member/month submission state remains unchanged
