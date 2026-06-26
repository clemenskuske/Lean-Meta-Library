# Duplicate Slug Update

This package is an acceptance fixture for the `general/slug-unique.mjs` checker.

Expected acceptance: the manifest's `SubmissionSlug` matches an existing slug in
the fixture's local `submissions.jsonl`, but both records use the same
`submissionIssueNumber`, so the checker must treat it as an update to the same
submission.
