# Unauthorized Statement Import

This package is a negative import fixture. The proof imports
`ConnectedGraph.Surface` directly even though the theorem metadata does not list
that statement/declaration file in declared used-file metadata.

Expected rejection: `dependency policy` reports that the proof imports a
statement/declaration module that is not authorized by metadata.
