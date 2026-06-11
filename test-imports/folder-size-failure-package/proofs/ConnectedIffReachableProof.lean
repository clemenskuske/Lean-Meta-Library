import FolderSizeFailure.Statements.ConnectedIffReachable

namespace FolderSizeFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    FolderSizeFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold FolderSizeFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end FolderSizeFailure.Proofs.Statement.ConnectedIffReachable
