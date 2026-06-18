# Duplicate Slug

This package is a negative import fixture for the `general/slug-unique.mjs` checker.

Expected rejection: the manifest's `SubmissionSlug` matches an existing slug in
the fixture's local `submissions.jsonl`, so the uniqueness checker must reject it.
