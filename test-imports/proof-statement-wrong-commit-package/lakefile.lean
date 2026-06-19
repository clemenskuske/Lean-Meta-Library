import Lake
open Lake DSL

package ProofStatementWrongCommit.Proofs where

require ProofStatementWrongCommit.Statements from "./statements"

require ExternalDependency.Statements from git
  "https://example.com/external-dependency.git" @ "2222222222222222222222222222222222222222"

@[default_target]
lean_lib ProofStatementWrongCommit.Proofs where
  srcDir := "proofs"
  roots := #[`ExternalProof]
