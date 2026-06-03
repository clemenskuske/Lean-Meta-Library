import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedGraph.Surface
import ConnectedIffReachable.Surface

namespace UnauthorizedSurfaceImport.Proofs.Theorem.ConnectedIffReachable

-- The proof theorem must have exactly the same type as the matching surface declaration.
-- `lml test` asks Lean to compare the compiled types of both constants.
theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    UnauthorizedSurfaceImport.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  by
    unfold UnauthorizedSurfaceImport.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro h
      exact ⟨h.nonempty, h.preconnected⟩
    · rintro ⟨hV, hreachable⟩
      exact { preconnected := hreachable, nonempty := hV }

end UnauthorizedSurfaceImport.Proofs.Theorem.ConnectedIffReachable
