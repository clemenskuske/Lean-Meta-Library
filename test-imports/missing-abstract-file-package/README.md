# Missing Abstract File

This package is a negative import fixture for the `general/files-present.mjs` checker.

Expected rejection: the manifest's `AbstractPath` points to a file that does not
exist on disk, so `general/files-present.mjs` must report the missing file.
