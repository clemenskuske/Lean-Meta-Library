import UnusedSorryProof.Statements.ConnectedIffReachable

namespace UnusedSorryProof.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    UnusedSorryProof.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold UnusedSorryProof.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end UnusedSorryProof.Proofs.Statement.ConnectedIffReachable
