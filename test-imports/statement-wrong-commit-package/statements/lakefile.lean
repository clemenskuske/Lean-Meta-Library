import Lake
open Lake DSL

package StatementWrongCommit.Statements where

require ExternalDependency.Statements from git
  "https://example.com/external-dependency.git" @ "2222222222222222222222222222222222222222"

@[default_target]
lean_lib StatementWrongCommit.Statements where
  roots := #[`StatementWrongCommit.Statements.Main]
