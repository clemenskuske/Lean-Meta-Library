# Unauthorized Statement Import

This package is a negative import fixture. The proof imports
`ConnectedGraph.Surface` directly even though the theorem metadata does not list
that statement file in declared `DeclarationReferences` metadata.

Expected rejection: `dependency policy` reports that the proof imports a
statement module that is not authorized by metadata.
