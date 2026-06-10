# Mismatched Proof Type

This package is a negative import fixture. The proof theorem has the expected
constant name, but its Lean type is deliberately different from the statement
axiom declaration.

Expected rejection: `connect axioms to proofs` reports that the proof theorem
type does not match the statement declaration type.
