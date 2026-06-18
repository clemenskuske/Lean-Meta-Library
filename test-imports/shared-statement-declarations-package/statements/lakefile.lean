import Lake
open Lake DSL

package SharedStatementDeclarations.Statements where

@[default_target]
lean_lib SharedStatementDeclarations.Statements where
  roots := #[`SharedStatementDeclarations.Statements.Pair]
