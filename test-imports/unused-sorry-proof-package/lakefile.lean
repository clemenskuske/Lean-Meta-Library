import Lake
open Lake DSL

package UnusedSorryProof.Proofs where

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "c5ea00351c28e24afc9f0f84379aa41082b1188f"

require UnusedSorryProof.Surface from "./surface-package"

@[default_target]
lean_lib UnusedSorryProof.Proofs where
  srcDir := "proofs"
  roots := #[`ConnectedIffReachableProof, `UnusedSorry]
