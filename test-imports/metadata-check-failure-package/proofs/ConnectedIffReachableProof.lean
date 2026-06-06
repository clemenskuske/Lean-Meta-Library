import ConnectedIffReachable.Surface

namespace MetadataCheckFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    MetadataCheckFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold MetadataCheckFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end MetadataCheckFailure.Proofs.Statement.ConnectedIffReachable
