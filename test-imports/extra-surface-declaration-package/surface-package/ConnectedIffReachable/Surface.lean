import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface

namespace ExtraSurfaceDeclaration.Surface.Statement.ConnectedIffReachable

def helperVertexCount : Nat := 0

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end ExtraSurfaceDeclaration.Surface.Statement.ConnectedIffReachable
