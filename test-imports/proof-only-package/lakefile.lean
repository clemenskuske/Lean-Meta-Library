import Lake
open Lake DSL

package ProofOnly.Proofs where

@[default_target]
lean_lib ProofOnly.Proofs where
  srcDir := "proofs"
  roots := #[`ProofOnlySmoke]
