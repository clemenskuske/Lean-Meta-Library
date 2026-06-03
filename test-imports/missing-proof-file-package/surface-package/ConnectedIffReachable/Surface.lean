import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface

namespace MissingProofFile.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    MissingProofFile.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end MissingProofFile.Surface.Statement.ConnectedIffReachable
