# Unused Sorry Proof

This package is a negative import fixture for proof-package sorry checks.

Expected rejection: `final-proof-build.mjs` reports `sorry` in final build
output because a non-manifest proof module contains a theorem proved with
`sorry`, even though the submitted proof theorem does not depend on it.
