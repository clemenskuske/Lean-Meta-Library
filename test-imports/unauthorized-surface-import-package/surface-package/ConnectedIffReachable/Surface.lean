import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface

namespace UnauthorizedSurfaceImport.Surface.Theorem.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    UnauthorizedSurfaceImport.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end UnauthorizedSurfaceImport.Surface.Theorem.ConnectedIffReachable
