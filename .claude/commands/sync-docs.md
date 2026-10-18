---
description: Bring the documents in line with the current code and update the implementation status
argument-hint: [optional module]
---

Synchronize the documentation with the code (scope: $ARGUMENTS; if empty, every module touched recently).

1. For each module in scope, compare the module document (`docs/modules/*.md`, and the related `spaces/` and `foundations/` documents) with the code, migrations and tests: fields, statuses and transitions, screens and routes, permissions, error codes, notification kinds, audit actions.
2. Apply the update table of `docs/standards/base.md` section 9.2. Where the code is right and the document is outdated, fix the document. Where the document is right and the code diverges, **do not silently change either**: list the divergence and ask.
3. Update each module's "Implementation status": files and migrations, validation actually performed (commands run and their result), what was **not** tested, external pending items. Never claim a test that was not run.
4. Check links (relative paths exist), the index in `docs/README.md` and the document map in `docs/technical-architecture-v0.1.md`.
5. Report what changed and which divergences need a decision.
