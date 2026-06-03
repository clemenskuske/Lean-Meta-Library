# Unauthorized Surface Import

This package is a negative import fixture. The proof imports
`ConnectedGraph.Surface` directly even though the theorem metadata does not list
that surface file in `usedSurfaceFiles`.

Expected rejection: `dependency policy` reports that the proof imports a surface
module that is not its own theorem surface module and is not authorized by
metadata.
