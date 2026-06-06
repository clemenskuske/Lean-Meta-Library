import ConnectedIffReachable.Surface

namespace FolderSizeFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    FolderSizeFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold FolderSizeFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end FolderSizeFailure.Proofs.Statement.ConnectedIffReachable
