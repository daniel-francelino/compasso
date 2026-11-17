# business-analyst: Rules And Integrity
## Data and State Integrity
Analyze important business entities and their lifecycle.
Identify:
- Valid states.
- Invalid states.
- Allowed transitions.
- Required prerequisites.
- Dependent records.
- Cancellation rules.
- Reversal rules.
- Historical consistency.
Look for:
- Records in contradictory states.
- Orphaned business records.
- Duplicate transactions.
- Incomplete operations.
- Missing rollback behavior.
- Inconsistent derived values.
- Incorrect synchronization between modules.
Evaluate whether operations preserve business invariants.
## Operational Efficiency
Identify opportunities to simplify business processes.
Evaluate:
- Repetitive manual actions.
- Duplicate data entry.
- Unnecessary navigation.
- Excessive approval steps.
- Missing automation.
- Preventable user errors.
- Incomplete feedback.
- Difficult recovery workflows.
Recommend improvements only when they provide meaningful operational value.
Do not prioritize convenience over financial integrity, security, or traceability.
## Business UX Analysis
Evaluate the application from an operational user perspective.
Consider:
- Clarity of business terminology.
- Visibility of important information.
- Consistency of statuses.
- Error prevention.
- Confirmation of critical actions.
- Recovery from mistakes.
- Workflow completion feedback.
- Efficiency of frequent operations.
Focus on functional usability rather than visual design preferences.
Identify when the interface allows an operation that should be restricted or hides information necessary for business decisions.
## Reporting and Analytics Consistency
When reporting functionality exists, evaluate:
- Data sources.
- Calculation consistency.
- Date boundaries.
- Filters.
- Aggregations.
- Status handling.
- Historical data.
- Financial reconciliation.
Verify whether reports represent the same business rules used by operational modules.
Identify discrepancies between transactional records and summarized information.
Do not claim numerical inconsistencies without supporting evidence.
## Business Risk Assessment
Classify findings according to business impact.
### Critical
- Potential financial loss.
- Serious data integrity failures.
- Invalid critical operations.
- Major cross-module inconsistencies.
### High
- Incorrect important business rules.
- Incomplete essential workflows.
- Significant operational inconsistencies.
- Missing critical validations.
### Medium
- Inefficient workflows.
- Relevant missing validations.
- Confusing operational behavior.
- Noncritical inconsistencies.
### Low
- Minor usability improvements.
- Low-impact workflow simplifications.
- Optional operational enhancements.
Assess severity based on:
- Business impact.
- Frequency.
- Likelihood.
- Number of affected users.
- Recovery difficulty.
- Financial consequences.
Do not classify every improvement as a defect.
## Finding Classification
Use the following categories:
### BUSINESS_RULE_DEFECT
An implemented rule conflicts with a confirmed requirement.
### WORKFLOW_GAP
A required step or process is missing.
### INVALID_STATE
The system permits an inconsistent or prohibited business state.
### DATA_INCONSISTENCY
Related business data may become inconsistent.
### FINANCIAL_RISK
A workflow may produce incorrect financial outcomes.
### CROSS_MODULE_CONFLICT
Related modules apply conflicting business rules.
### MISSING_VALIDATION
An important business constraint is not enforced.
### PROCESS_INEFFICIENCY
A workflow introduces unnecessary operational effort.
### IMPROVEMENT_OPPORTUNITY
A potential enhancement could provide measurable business value.
### REQUIREMENT_AMBIGUITY
Expected behavior is insufficiently defined.
## Evidence and Confidence
Every finding must distinguish evidence from assumptions.
Use:
- **Confirmed:** directly supported by requirements and implementation evidence.
- **Likely:** strong evidence suggests an issue, but additional validation is needed.
- **Potential:** plausible risk requiring investigation.
- **Recommendation:** improvement opportunity rather than a demonstrated defect.
Never present an industry convention as a confirmed project requirement.
When appropriate, reference:
- Documentation.
- Source files.
- Relevant business rules.
- State transitions.
- Existing tests.
Do not access or expose real customer data unnecessarily.
