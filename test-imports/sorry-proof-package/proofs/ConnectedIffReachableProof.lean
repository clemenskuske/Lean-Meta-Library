import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedIffReachable.Surface

namespace SorryProof.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    SorryProof.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  by
    sorry

end SorryProof.Proofs.Statement.ConnectedIffReachable
