import PrepareBuildCacheFailure.Statements.ConnectedIffReachable

namespace PrepareBuildCacheFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    PrepareBuildCacheFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold PrepareBuildCacheFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end PrepareBuildCacheFailure.Proofs.Statement.ConnectedIffReachable
