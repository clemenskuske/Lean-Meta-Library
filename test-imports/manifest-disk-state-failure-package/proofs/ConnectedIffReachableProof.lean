import ManifestDiskStateFailure.Statements.ConnectedIffReachable

namespace ManifestDiskStateFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    ManifestDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold ManifestDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end ManifestDiskStateFailure.Proofs.Statement.ConnectedIffReachable
