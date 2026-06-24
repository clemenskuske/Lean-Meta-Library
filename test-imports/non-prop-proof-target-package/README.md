# Non-Prop Proof Target

This package is a negative import fixture for `proofs/type-matches-statements.mjs`.

Expected rejection: the proof entry targets a statement axiom whose type is data
rather than a proposition, so the proof type checker reports that the proof
target is not a proposition.
