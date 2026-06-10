# Metadata Disk State Failure

This package is a negative import fixture. The disk contains an additional
surface declaration folder that is not listed in `meta.yaml`.

Expected rejection: `files present` reports that the declaration folder is
present on disk but not listed in metadata.
