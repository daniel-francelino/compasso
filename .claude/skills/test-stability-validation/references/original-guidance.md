# test-reviewer: Stability And Validation
## Test Layer Review
Evaluate whether each test uses an appropriate testing layer.
Possible layers include:
- Unit.
- Component.
- Integration.
- API / Contract.
- End-to-End.
- Performance.
- Security.
Prefer the lowest-cost layer capable of reliably detecting the relevant failure.
Flag unnecessary E2E tests when lower-level tests provide equivalent confidence.
Flag insufficient isolation when the selected layer cannot verify the required behavior.
Do not recommend moving tests between layers without explaining the benefit.
## Coverage Review
Compare implemented tests with expected scenarios.
Classify each scenario as:
- **Verified:** test exists, assertions are adequate, and execution succeeded.
- **Partially Verified:** some behavior is covered, but important aspects remain unverified.
- **Not Verified:** test is missing or insufficient.
- **Blocked:** validation could not be completed because of an environment or dependency limitation.
Do not confuse line coverage with behavioral coverage.
Coverage metrics may support the review but cannot replace assertion analysis.
Prioritize missing coverage based on actual risk.
## Test Execution
Execute relevant tests when the environment permits.
### Execution Rules
- Discover the project's test commands.
- Run focused tests first.
- Capture actual results.
- Record failures and skips.
- Identify environmental limitations.
- Avoid unnecessary full-suite execution.
### Flakiness Investigation
When instability is suspected:
- Repeat the affected test.
- Compare execution results.
- Investigate timing and state dependencies.
- Record inconsistent behavior.
Do not classify a test as flaky solely because it failed once.
Do not classify a test as stable solely because it passed once.
### Execution Evidence
Record:
- Command executed.
- Result.
- Passed tests.
- Failed tests.
- Skipped tests.
- Relevant execution limitations.
Never report a test as passing without actual execution evidence.
## Defect Detection Validation
When assertion effectiveness is uncertain, evaluate whether the test would detect a meaningful defect.
### Preferred Approach
First use static reasoning:
1. Identify the protected behavior.
2. Identify a plausible incorrect implementation.
3. Determine which assertion should fail.
4. Verify whether that assertion actually depends on the behavior.
### Mutation Testing
Mutation testing may provide stronger evidence.
However:
- Do not modify production code by default.
- Do not modify tests.
- Do not modify baselines.
- Do not execute mutation experiments without authorization.
- Prefer dedicated mutation-testing tools when available.
- Avoid destructive Git operations.
When explicitly authorized, perform mutation experiments only in a safe, isolated environment.
The original working tree must remain unchanged.
If mutation testing is unavailable, report the limitation rather than claiming mutation-based validation.
## Finding Classification
Classify findings using the following categories.
### FALSE_POSITIVE
The test may pass despite incorrect behavior.
### MISSING_COVERAGE
A required scenario is not adequately tested.
### WEAK_ASSERTION
Assertions do not sufficiently verify the expected outcome.
### FLAKY
The test demonstrates inconsistent behavior or has a substantiated instability risk.
### FRAGILE
The test depends on unstable selectors, timing, or implementation details.
### WRONG_LAYER
The selected test layer is inappropriate or unnecessarily expensive.
### ISOLATION
The test depends on shared state or other tests.
### CONVENTION
The implementation violates relevant project testing conventions.
### ENVIRONMENT
Validation is blocked by missing dependencies or configuration.
### MAINTAINABILITY
The test introduces unnecessary complexity, duplication, or difficult maintenance.
## Severity Classification
Assign severity based on impact.
### Critical
- False positives in critical behavior.
- Missing critical security coverage.
- Tests that cannot detect serious data integrity defects.
### High
- Important acceptance criteria not verified.
- Significant assertion gaps.
- Confirmed flaky tests affecting important workflows.
### Medium
- Fragile selectors.
- Noncritical coverage gaps.
- Excessive mocking.
- Incorrect test layers.
### Low
- Naming inconsistencies.
- Minor duplication.
- Low-impact maintainability issues.
Severity must reflect the actual risk.
