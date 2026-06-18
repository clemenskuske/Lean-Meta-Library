# Commit Hash Failure

This package is a negative import fixture for the `general/commit-is-hash.mjs` checker.

Expected rejection: the manifest's `Commit` field is set to a branch name instead
of a SHA-1 hash, so `general/commit-is-hash.mjs` must reject it.
