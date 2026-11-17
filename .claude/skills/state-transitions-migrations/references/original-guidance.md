# data-integrity-auditor: Transactions And Concurrency
## State Transition Integrity
Analyze important entity lifecycles.
Identify:
- Valid states.
- Allowed transitions.
- Required prerequisites.
- Terminal states.
- Cancellation rules.
- Reversal behavior.
- Dependent records.
- Historical consistency.
Look for:
- Invalid transitions.
- Missing transition validation.
- Contradictory statuses.
- Incomplete workflows.
- Stale dependent records.
- Unauthorized state changes.
- Irreversible operations without appropriate safeguards.
Verify that state transitions preserve relevant business invariants.
## Cross-Module Consistency
ERP modules frequently share related business data.
Analyze relevant relationships such as:
- Orders and payments.
- Sales and inventory.
- Services and commissions.
- Purchases and payables.
- Invoices and receivables.
- Refunds and balances.
- Transactions and reports.
- Users and organizations.
These are examples, not assumptions about the project.
Identify:
- Missing dependent updates.
- Duplicate side effects.
- Inconsistent derived values.
- Broken references.
- Conflicting status definitions.
- Incomplete reversals.
- Stale synchronized data.
Determine whether consistency is expected to be immediate or eventual.
For eventual consistency, evaluate retry, recovery, and reconciliation mechanisms.
## Database Constraints
Evaluate whether critical integrity rules are appropriately enforced.
Consider:
- Primary keys.
- Foreign keys.
- Unique indexes.
- Partial unique indexes.
- Check constraints.
- Not-null constraints.
- Transaction isolation.
- Database triggers.
- Row-level security when applicable.
Identify rules enforced only in application code that may require stronger database protection.
Do not recommend database constraints that conflict with valid business workflows.
Explain the tradeoffs of proposed changes.
## Migration Integrity
Review relevant database migrations for:
- Data loss risks.
- Unsafe schema changes.
- Missing backfills.
- Incorrect defaults.
- Constraint violations.
- Incompatible type changes.
- Incomplete transformations.
- Migration ordering.
- Rollback limitations.
- Compatibility with existing records.
Evaluate whether migrations preserve existing business data.
Do not execute migrations automatically.
Do not modify migration files.
When relevant, recommend safe rollout and validation procedures.
## Data Precision and Representation
When applicable, evaluate:
- Monetary precision.
- Decimal handling.
- Floating-point risks.
- Date and time representation.
- Time zone consistency.
- Identifier formats.
- Null versus zero semantics.
- Enum and status consistency.
- Serialization and deserialization.
Identify representation differences that may cause inconsistent data between modules.
For financial calculations, coordinate findings with the Financial Auditor.
## Background Jobs and Event Consistency
When applicable, analyze:
- Job retries.
- Event duplication.
- Message ordering.
- Failed event handling.
- Dead-letter processing.
- Outbox patterns.
- Partial processing.
- Eventual consistency.
- Recovery procedures.
Identify scenarios where background operations may create incomplete or duplicated data.
Verify whether processing failures can be safely recovered.
## Data Integrity Testing
Review existing tests for:
- Relationship integrity.
- Duplicate prevention.
- Transaction rollback.
- Concurrent updates.
- Invalid state transitions.
- Partial failures.
- Cross-module consistency.
- Data deletion behavior.
- Migration safety.
Identify missing regression scenarios.
Do not implement tests.
Provide actionable scenarios to the Test Designer.
## Finding Validation
Every finding must be supported by evidence.
Classify confidence as:
### Confirmed
A defect is directly supported by verified implementation behavior or authorized test evidence.
### Likely
Strong evidence suggests an integrity defect, but complete confirmation is unavailable.
### Potential
A plausible integrity risk requires further investigation.
### Recommendation
An improvement opportunity without a demonstrated defect.
For each significant finding, include:
- Relevant invariant.
- Affected entities.
- Current implementation behavior.
- Failure scenario.
- Potential impact.
- Supporting evidence.
- Recommended remediation.
- Suggested regression test.
Do not classify a risk as confirmed solely because a database constraint is absent.
