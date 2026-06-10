# Statement File Context Failure

This package is a negative import fixture for the legacy
`surface-file-context.mjs` checker, which should become the statement-file
context checker during the structure rework.

Expected rejection: the context check reports a forbidden eval command in the
statement/declaration file.
