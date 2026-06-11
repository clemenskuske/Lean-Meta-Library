import ExtraStatementDeclaration.Statements.ConnectedIffReachable

namespace ExtraStatementDeclaration.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    ExtraStatementDeclaration.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold ExtraStatementDeclaration.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end ExtraStatementDeclaration.Proofs.Statement.ConnectedIffReachable
