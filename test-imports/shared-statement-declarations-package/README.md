# Shared Statement Declarations

This package is an acceptance fixture. A single statement Lean file introduces
two declarations, and both are listed as public statement entries in the
manifest.

Expected acceptance: the declaration checker accepts multiple manifest-listed
declarations in one statement module while still validating each declaration's
kind.
