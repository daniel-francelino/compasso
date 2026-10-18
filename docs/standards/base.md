# Interface and behavior standards

> Cross-cutting rules for every screen and feature of Compasso (back office, client portal and public site). Compasso is a single-organization product whose data is isolated **by brand**; multi-company rules only apply if that scope is explicitly introduced. UI copy is Brazilian Portuguese; everything else is English. In case of conflict, `AGENTS.md` and `technical-architecture-v0.1.md` prevail. Origin: the standards of the Memoria Print project, adapted to Compasso.

**1. Lists and pagination**

- Every list that can grow must be paginated, either by page navigation or infinite scroll.
- Search, filters and sorting must consider all records, not only the ones already loaded.
- When filters or search change, reset the pagination.
- Show loading, empty list, no results and error states.
- With infinite scroll, avoid duplicate records and indicate when everything has been loaded.

**2. Loading and action blocking**

- Use a skeleton for the initial loading of pages, lists and details, keeping the space of the elements to avoid layout shifts.
- While a form is submitting, show loading on the button and prevent duplicate submissions.
- Block the actions that depend on the operation in progress or may conflict with it.
- Keep independent actions available, such as navigating or cancelling when allowed.
- On error, end the loading, release the actions and allow retrying.
- Preserve the filled-in data when an operation fails.

**3. Forms and validation**

- All forms must have validation on the frontend and on the backend.
- Identify required fields and state the expected formats and limits.
- Show clear messages next to the field in error.
- Validate formats, limits, relations between fields and business rules.
- When trying to submit an invalid form, move focus to the first error.
- Prevent multiple submissions while the request is in progress.
- Warn before discarding unsaved changes.
- On uploads, validate file type, size and quantity.

**4. Operation feedback**

- Report the result of actions such as create, edit, delete and export.
- Show useful error messages without exposing internal details.
- Confirm destructive actions, identifying the affected record.
- Offer recovery or undo when applicable.
- Do not report success before the operation is confirmed as completed.

**5. Navigation and consistency**

- Keep headers, buttons and actions in consistent positions.
- Use the same components and terms for equivalent behavior.
- Preserve filters and list position when coming back from a detail, when possible.
- Provide a clear main action on each page.
- Handle non-existent pages and access denied with guidance on how to continue.

**6. Responsiveness and accessibility**

- Allow use on mobile, tablet and desktop.
- Avoid horizontal overflow and unexpected layout changes.
- Adapt tables and actions to small screens.
- Guarantee keyboard navigation, visible focus and labels on fields.
- Do not communicate states by color alone.
- Offer adequate touch areas and readable contrast (Compasso targets AAA for body text, see `color-palette.md`).

**7. Authentication, permissions and isolation**

- Protect pages and operations that require authentication.
- Validate permissions on the backend, in addition to controlling the interface.
- Isolate each brand's data in every query and operation: a user only acts on the brands they are linked to, and the check happens in the database (RLS) and on the server.
- External users (client portal) never read internal tables; they only read through dedicated `portal_*` functions that return safe columns.
- Handle an expired session without needlessly losing the user's work.
- Never trust a brand, client or organization identifier sent by the frontend without checking access.

**8. Data and reliability**

- Validate inputs and business rules before saving data.
- Avoid duplication and races in critical operations: submitting for approval, deciding an approval, accepting an invitation, publishing (use transactions, locks and unique indexes).
- Define standards for dates and time zones: instants in UTC plus the IANA time zone of the brand; deadlines as local dates; everything formatted through `src/lib/shared/format.ts`.
- An approved revision is immutable; changes create a new revision.
- Record relevant changes and who made them.
- Define backup, recovery and export of the data.
- Avoid including sensitive data in the logs.

**9. Reusable components**

- Prioritize generic components for recurring elements: buttons, fields, modals, tables, pagination, skeletons and status messages.
- Before creating a component, check whether one already exists that can be reused or adapted.
- Configure variations through properties and slots, avoiding copying components with small differences.
- Separate visual components from business-specific rules.
- Keep a clear responsibility per component.
- Avoid components with too many options. Create abstractions when there is real reuse.

**10. Code organization**

- Organize features by module, such as clients, brands, content and approvals.
- Separate presentation, business rules and data access.
- Extract shared logic into composables, hooks, services or utility functions.
- Use clear and consistent names for files, variables and functions.
- Remove dead code, unnecessary imports and commented-out code without purpose.

**11. Typing and contracts**

- Use consistent typing for data, properties and API responses.
- Avoid `any`; when necessary, justify and limit its use.
- Define clear contracts for requests, responses and errors.
- Validate external data at runtime: typing alone does not guarantee that a response is valid.
- Standardize pagination metadata.

**12. API integration**

- Centralize the HTTP client configuration and the common error handling.
- Cancel or ignore old requests when a new search or filter replaces them.
- Apply debounce to searches to avoid a request on every keystroke.
- Update or invalidate cached data after changes.
- Preserve filters and pagination when refreshing a list.
- Use automatic retries only when they are safe, avoiding duplicating operations.

**13. Design system**

- Centralize colors, typography, spacing, borders and sizes in tokens.
- Standardize the component states: normal, hover, focus, disabled, loading and error.
- Avoid arbitrary visual values scattered across the code.
- Reuse layout patterns for list, detail and form pages.

**14. Security**

- Keep credentials and secrets exclusively on the backend.
- Check authentication, permissions and access to records on every operation.
- Use parameterized queries and handle content supplied by users.
- Apply limits to requests and uploads.
- Collect and store only the personal data that is necessary.

**15. Quality and maintenance**

- Use a formatter and linter with shared configuration.
- Test business rules, permissions and critical flows.
- Check error scenarios, slow connections and duplicate submissions.
- Keep changes small and with a clear purpose.
- Document relevant decisions, configuration and how to run the project.
- Automate type, lint, test and build checks before publishing.

**16. Performance and observability**

- Load modules and images on demand when appropriate.
- Avoid repeated queries and responses with unnecessary data.
- Use virtualization in long lists when needed.
- Monitor errors and important operations, without recording sensitive data.
- Identify requests in the logs to ease the investigation of problems.

**Feature completion checklist**

- [ ] Pagination implemented when applicable.
- [ ] Skeleton and loading states defined.
- [ ] Conflicting actions blocked during operations.
- [ ] Empty, success and error states handled.
- [ ] Forms validated on the frontend and on the backend.
- [ ] Permissions and data isolation verified.
- [ ] Layout reviewed on mobile, tablet and desktop.
- [ ] Main flows and relevant failures verified.
