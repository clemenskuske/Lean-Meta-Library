# Update Unknown Slug

This package is a negative import fixture for the `general/submission-update-policy.mjs` checker.

Expected rejection: the manifest has a `SubmissionSlug`, but no matching row
exists in `submissions.jsonl`, so it cannot be treated as an update.
