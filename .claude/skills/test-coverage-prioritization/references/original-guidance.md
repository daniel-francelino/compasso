# test-designer: Coverage And Prioritization
## Prioritization
Assign priorities according to impact and likelihood.
| Priority | Meaning |
|---|---|
| P0 | Critical security, data integrity, financial, or essential functionality |
| P1 | Primary workflows and important business rules |
| P2 | Secondary workflows and relevant edge cases |
| P3 | Low-impact or complementary behavior |
Priorities must reflect the project's actual context.
## Test Layer Selection
Recommend the lowest-cost layer that reliably detects the failure.
Possible layers:
- Unit
- Component
- Integration
- API / Contract
- End-to-End
- Performance
- Security
Prefer unit or integration tests over E2E when sufficient.
Follow existing project conventions and testing tools.
Do not assume Playwright, Vitest, Jest, Cypress, or any other framework.
## Scenario Requirements
Each scenario must include:
| Field | Description |
|---|---|
| ID | Stable unique identifier |
| Title | Behavior being validated |
| Priority | P0–P3 |
| Layer | Recommended test layer |
| Preconditions | Required initial state |
| Action | Operation performed |
| Expected Result | Specific observable outcome |
| Coverage | Covered, Partial, Uncovered, or Unverified |
Use existing scenario identifiers when available.
Every scenario must be:
- Clear.
- Reproducible.
- Verifiable.
- Falsifiable.
- Relevant.
- Implementable.
Avoid vague criteria such as "works correctly" or "handles errors".
Specify observable results such as HTTP status, response properties, UI state, or database changes.
## Coverage Analysis
Inspect existing tests before proposing new ones.
Classify coverage as:
- **Covered:** existing tests verify the behavior.
- **Partial:** only part of the behavior is verified.
- **Uncovered:** no adequate test was found.
- **Unverified:** insufficient evidence.
Reference existing test files when available.
Do not claim a test passes without execution evidence.
Do not duplicate scenarios already adequately covered.
## Output Format
Keep the final response compact.
### Summary
Provide:
- Functionality analyzed.
- Main risks.
- Existing coverage.
Maximum: 5 bullet points.
### Test Scenario Matrix
Use a Markdown table:
| ID | Priority | Scenario | Layer | Preconditions | Action | Expected Result | Coverage |
|---|---|---|---|---|---|---|---|
Group related scenarios when useful.
Sort by priority.
### Coverage Gaps
List only meaningful missing coverage.
### Open Questions
Include only unresolved questions that affect expected behavior.
Omit this section when unnecessary.
### Engineer Handoff
Provide concise implementation guidance:
- Recommended test layers.
- Relevant files.
- Required fixtures or mocks.
- Environment dependencies.
- Potential flaky conditions.
Avoid repeating the scenario matrix.
