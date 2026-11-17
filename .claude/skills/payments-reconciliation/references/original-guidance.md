# financial-auditor: Payments And Reconciliation
## Revenue, Costs, and Profitability
When applicable, evaluate:
- Gross revenue.
- Net revenue.
- Collected revenue.
- Outstanding receivables.
- Direct costs.
- Operating expenses.
- Commissions.
- Fees.
- Gross profit.
- Net profit.
- Margins.
Verify that reports distinguish different financial concepts.
Revenue is not necessarily cash received.
Cash balance is not necessarily profit.
Gross profit is not necessarily net profit.
Confirm which definitions the ERP uses before assessing correctness.
Do not invent accounting policies.
## Financial Reporting
Audit reports for:
- Correct source data.
- Consistent business rules.
- Accurate aggregation.
- Correct filters.
- Date boundaries.
- Time zones.
- Currency handling.
- Cancellations.
- Refunds.
- Pending transactions.
- Duplicate records.
- Historical consistency.
Compare report totals with underlying valid transactions when suitable evidence is available.
Verify that different reports do not unintentionally apply conflicting definitions to the same metric.
Document differences between:
- Transaction date.
- Payment date.
- Settlement date.
- Accounting recognition date.
Use the definitions established by the project.
## Cross-Module Financial Consistency
Identify dependencies between relevant modules.
Examples:
- Orders and invoices.
- Sales and payments.
- Payments and receivables.
- Services and commissions.
- Purchases and payables.
- Inventory and costs.
- Refunds and financial reports.
- Transactions and account balances.
Verify that operations maintain consistent financial state across modules.
Look for:
- Missing updates.
- Duplicate financial effects.
- Inconsistent totals.
- Stale derived values.
- Incorrect state transitions.
- Incomplete reversals.
- Broken historical references.
Do not assume all example modules exist.
## Transaction Integrity
When relevant, evaluate:
- Atomicity.
- Concurrent updates.
- Duplicate requests.
- Idempotency.
- Transaction boundaries.
- Rollbacks.
- Partial failures.
- Retry behavior.
- Race conditions.
- Financial event ordering.
Identify scenarios where concurrent or repeated operations may create incorrect balances or duplicate financial records.
Do not perform destructive concurrency tests without authorization.
## Financial Invariants
Identify important invariants for the analyzed domain.
Examples:
- A transaction's total must match its valid components.
- Outstanding balances must reconcile with applied payments and adjustments.
- Financial reversals must preserve an auditable history.
- Report totals must reconcile with the underlying eligible transactions.
- Commission payouts must not exceed the legitimately payable amount unless explicitly permitted.
Treat these as candidate invariants.
Validate each against confirmed project rules before classifying violations.
## Audit Scenarios
Evaluate relevant scenarios such as:
- Zero-value transactions.
- Smallest supported monetary unit.
- Large monetary amounts.
- Percentage boundaries.
- Multiple discounts.
- Partial payments.
- Multiple installments.
- Duplicate submissions.
- Concurrent payments.
- Cancellation after payment.
- Refund after commission payout.
- Historical commission rate changes.
- Transactions crossing reporting periods.
- Time zone boundaries.
- Rounding differences between line items and totals.
Prioritize realistic, high-impact cases.
Avoid generating unnecessary scenario combinations.
## Findings and Evidence
Classify findings as:
### Confirmed
A discrepancy is supported by a verified business rule and reproducible evidence.
### Likely
Strong evidence suggests a defect, but complete verification is unavailable.
### Potential
A plausible financial risk requires additional validation.
### Recommendation
An improvement opportunity without a demonstrated defect.
For every significant finding, include:
- Affected business rule.
- Expected result.
- Observed result or implementation behavior.
- Relevant inputs.
- Independent calculation.
- Financial impact.
- Source references.
- Recommended correction.
- Suggested regression test.
Do not claim a calculation is incorrect without a defensible expected result.
