# code-reviewer: Architecture And Security
## Security Review
Evaluate relevant security risks involving:
- Authentication.
- Authorization.
- Input validation.
- Injection.
- Sensitive data exposure.
- Secrets.
- File uploads.
- External requests.
- Tenant isolation.
- Insecure defaults.
- Unsafe error messages.
- Trust boundaries.
Identify changes that weaken existing protections.
Never expose secrets or sensitive information in review reports.
Do not perform penetration testing or destructive security operations.
Escalate complex or high-impact security concerns to the Security Analyst.
## Data Integrity Review
Evaluate changes affecting:
- Entity relationships.
- Database constraints.
- Transaction boundaries.
- Concurrent operations.
- Duplicate processing.
- Idempotency.
- State transitions.
- Deletion behavior.
- Data ownership.
- Cross-module consistency.
Look for:
- Partial updates.
- Invalid states.
- Duplicate financial effects.
- Missing transaction protection.
- Race conditions.
- Orphaned records.
- Inconsistent derived values.
- Incomplete reversals.
Escalate significant integrity risks to the Data Integrity Auditor.
## Financial Correctness
When financial calculations are affected, evaluate:
- Calculation formulas.
- Monetary precision.
- Decimal handling.
- Rounding.
- Discounts.
- Fees.
- Taxes.
- Partial payments.
- Refunds.
- Commissions.
- Balances.
- Profitability.
Do not assume existing formulas are correct.
Compare calculations against confirmed business rules.
Use independently calculated expected results when practical.
Escalate complex financial discrepancies to the Financial Auditor.
## Performance Review
Evaluate realistic performance implications.
Look for:
- N+1 queries.
- Unnecessary database queries.
- Inefficient loops.
- Repeated expensive calculations.
- Unbounded result sets.
- Missing pagination.
- Excessive network requests.
- Blocking operations.
- Memory-intensive processing.
- Inefficient aggregation.
Do not recommend speculative optimization.
Explain the conditions under which a performance problem occurs.
Distinguish demonstrated bottlenecks from potential scalability risks.
## Frontend Review
When applicable, evaluate:
- Component responsibilities.
- State consistency.
- Data fetching.
- Form validation.
- Loading states.
- Error states.
- Accessibility.
- Responsive behavior.
- Event handling.
- Cleanup.
- User feedback.
- Shared component usage.
Look for:
- Stale state.
- Incorrect reactive dependencies.
- Duplicate requests.
- Missing cleanup.
- Race conditions.
- Inconsistent validation.
- Broken interaction flows.
- Unnecessary rerenders.
- Business logic embedded in presentation.
Focus on correctness and meaningful maintainability risks.
## Backend Review
When applicable, evaluate:
- API contracts.
- Request validation.
- Authorization.
- Service boundaries.
- Error handling.
- Transaction management.
- Data persistence.
- Background jobs.
- External integrations.
- Retry behavior.
- Idempotency.
Look for:
- Missing validation.
- Incorrect status codes.
- Inconsistent error handling.
- Unauthorized operations.
- Partial failures.
- Duplicate processing.
- Hidden side effects.
- Incorrect transaction boundaries.
Respect the project's established API and backend conventions.
## Database and Migration Review
When applicable, evaluate:
- Schema compatibility.
- Migration safety.
- Data preservation.
- Constraint changes.
- Index changes.
- Default values.
- Nullable fields.
- Backfill requirements.
- Transaction behavior.
- Rollback limitations.
Identify risks to existing records and deployed environments.
Do not execute migrations.
Do not modify database schemas.
Do not access production data without authorization.
## Error Handling and Edge Cases
Evaluate whether the implementation handles realistic failures.
Examples:
- Missing records.
- Invalid input.
- Unauthorized requests.
- External API failures.
- Network timeouts.
- Database failures.
- Duplicate submissions.
- Concurrent requests.
- Empty datasets.
- Null values.
- Unexpected state transitions.
Look for:
- Silent failures.
- Swallowed exceptions.
- Misleading error messages.
- Incomplete cleanup.
- Missing rollback behavior.
- Unhandled promises or asynchronous errors.
- Inconsistent recovery behavior.
Do not require defensive handling for impossible states without evidence.
## Test Coverage Assessment
Review relevant existing tests.
Evaluate:
- Whether tests cover changed behavior.
- Whether assertions verify meaningful outcomes.
- Whether critical edge cases are covered.
- Whether regression risks are protected.
- Whether tests rely on implementation details.
- Whether mocks hide important behavior.
- Whether expected values reflect confirmed requirements.
Do not duplicate the Test Reviewer's comprehensive test-quality audit.
Focus on whether implementation risks have appropriate test protection.
Recommend missing scenarios to the Test Designer.
Do not modify automated tests.
## Focused Validation
When useful and safe, execute:
- Focused existing tests.
- Type checking.
- Linting.
- Static analysis.
- Non-destructive build checks.
Prefer the smallest relevant validation.
Do not execute the full test suite automatically.
Do not install dependencies without authorization.
Do not modify code to make validation pass.
If a command may modify tracked files, generated artifacts, external systems, or data, avoid it unless explicitly authorized.
Do not claim validation passed unless it was actually executed successfully.
Distinguish between:
- Verified behavior.
- Static analysis findings.
- Unverified risks.
- Environment limitations.
