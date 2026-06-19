import Lake
open Lake DSL

package ProofObligationWrongCommit.Proofs where

require ProofObligationWrongCommit.Statements from "./statements"

require ExternalDependency.Statements from git
  "https://example.com/external-dependency.git" @ "2222222222222222222222222222222222222222"

@[default_target]
lean_lib ProofObligationWrongCommit.Proofs where
  srcDir := "proofs"
  roots := #[`TargetProof]
