import Lake
open Lake DSL

package UndeclaredProofObligation.Proofs where

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "c5ea00351c28e24afc9f0f84379aa41082b1188f"

require UndeclaredProofObligation.Statements from "./statements"

@[default_target]
lean_lib UndeclaredProofObligation.Proofs where
  srcDir := "proofs"
  roots := #[`TargetProof]
