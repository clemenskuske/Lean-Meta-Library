# Manifest Disk State Failure

This package is a negative import fixture. The disk contains an additional
statement file that is not listed in `manifest.yaml`.

Expected rejection: `statements/no-extra-files.mjs` reports that the statement
file is present on disk but not listed in manifest.
