# Missing Proof File

This package is a negative import fixture. The metadata names the proof
declaration `MissingProofFile.Proofs.Statement.ConnectedIffReachable.connected_iff_reachable`,
but its source file is intentionally absent from the proof package.

Expected rejection: the proof package fails to build, so
`proofs/type-matches-statements.mjs` cannot resolve the named proof declaration.
