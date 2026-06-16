import MetadataCheckFailure.Statements.ConnectedIffReachable

namespace MetadataCheckFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    MetadataCheckFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold MetadataCheckFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end MetadataCheckFailure.Proofs.Statement.ConnectedIffReachable
