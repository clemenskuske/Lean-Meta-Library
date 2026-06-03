import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface

namespace MismatchedProofType.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    MismatchedProofType.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end MismatchedProofType.Surface.Statement.ConnectedIffReachable
