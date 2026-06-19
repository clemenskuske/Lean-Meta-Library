# Proof Obligation Wrong Commit

This negative fixture lists an external submitted statement in
`ProofObligations`, while the proof lakefile pins that statement package to a
different commit than the one recorded in `submissions.jsonl`.

Expected rejection: `proofs/imports.mjs` reports that the proof lakefile
dependency is not allowed by `submissions.jsonl`.
