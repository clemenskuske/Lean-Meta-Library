import ConnectedIffReachable.Surface

namespace PrepareBuildCacheFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    PrepareBuildCacheFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold PrepareBuildCacheFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end PrepareBuildCacheFailure.Proofs.Statement.ConnectedIffReachable
