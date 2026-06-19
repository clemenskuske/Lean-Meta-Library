Negative fixture for `proofs/no-forbidden-axioms.mjs`.

Expected rejection: the submitted proof target depends on a statement axiom that
is not listed in the proof entry's `ProofObligations`, so the proof axiom
checker reports `UNDECLARED_AXIOM`.
