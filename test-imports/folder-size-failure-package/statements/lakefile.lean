import Lake
open Lake DSL

package FolderSizeFailure.Statements where

require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "c5ea00351c28e24afc9f0f84379aa41082b1188f"

@[default_target]
lean_lib FolderSizeFailure.Statements where
  roots := #[`FolderSizeFailure.Statements.ConnectedGraph, `FolderSizeFailure.Statements.ConnectedIffReachable]
