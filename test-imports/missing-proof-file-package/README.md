# Missing Proof File

This package is a negative import fixture. The metadata lists
`proofs/ConnectedIffReachableProof.lean`, but that file is intentionally absent.

Expected rejection: `general/files-present.mjs` reports the missing
`Proof.File` path.
