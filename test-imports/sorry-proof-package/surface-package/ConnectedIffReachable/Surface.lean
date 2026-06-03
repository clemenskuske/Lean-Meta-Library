import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface

namespace SorryProof.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    SorryProof.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end SorryProof.Surface.Statement.ConnectedIffReachable
