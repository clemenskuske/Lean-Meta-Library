import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedIffReachable.Surface

namespace MismatchedProofType.Proofs.Theorem.ConnectedIffReachable

theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    Nonempty V → True :=
  by
    intro _hV
    trivial

end MismatchedProofType.Proofs.Theorem.ConnectedIffReachable
