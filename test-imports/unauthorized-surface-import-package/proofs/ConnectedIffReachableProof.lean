import ConnectedGraph.Surface
import ConnectedIffReachable.Surface

namespace UnauthorizedSurfaceImport.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    UnauthorizedSurfaceImport.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold UnauthorizedSurfaceImport.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end UnauthorizedSurfaceImport.Proofs.Statement.ConnectedIffReachable
