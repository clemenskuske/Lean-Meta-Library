import ManifestCheckFailure.Statements.ConnectedIffReachable

namespace ManifestCheckFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    ManifestCheckFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold ManifestCheckFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end ManifestCheckFailure.Proofs.Statement.ConnectedIffReachable
