# Missing License

This package is a negative import fixture for the `general/license.mjs` checker.

Expected rejection: the manifest has no `LicenseFile` field, so `general/license.mjs`
must reject the submission for not declaring a license file.
