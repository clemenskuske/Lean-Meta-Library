import MetadataDiskStateFailure.Statements.ConnectedIffReachable

namespace ExtraStatementDeclaration.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    MetadataDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold MetadataDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end ExtraStatementDeclaration.Proofs.Statement.ConnectedIffReachable
