import ConnectedIffReachable.Surface

namespace SurfaceSorryStatement.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    SurfaceSorryStatement.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold SurfaceSorryStatement.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end SurfaceSorryStatement.Proofs.Statement.ConnectedIffReachable
