import ConnectedIffReachable.Surface

namespace UnusedSorryProof.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    UnusedSorryProof.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold UnusedSorryProof.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end UnusedSorryProof.Proofs.Statement.ConnectedIffReachable
