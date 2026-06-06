import ConnectedIffReachable.Surface

namespace SurfaceFileContextFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    SurfaceFileContextFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold SurfaceFileContextFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end SurfaceFileContextFailure.Proofs.Statement.ConnectedIffReachable
