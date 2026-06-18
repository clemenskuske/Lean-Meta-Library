# Manifest Version Mismatch

This package is a negative import fixture for the `general/manifest-check.mjs` checker.

Expected rejection: the manifest sets `leanVersion` and `mathlibVersion` to values
that do not match the pinned versions in `lml-env.json`, so `general/manifest-check.mjs`
must reject the mismatched versions.
