# Sorry Proof

This package is a negative import fixture. The theorem proof has the right
statement, but it is closed with `sorry`.

Expected rejection: `proofs/no-forbidden-axioms.mjs` reports that the compiled
proof depends on `sorryAx`.
