import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ConnectedIffReachable.Surface

namespace ExtraSurfaceDeclaration.Proofs.Theorem.ConnectedIffReachable

-- The proof theorem must have exactly the same type as the matching surface declaration.
-- `lml test` asks Lean to compare the compiled types of both constants.
theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  by
    unfold ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro h
      exact ⟨h.nonempty, h.preconnected⟩
    · rintro ⟨hV, hreachable⟩
      exact { preconnected := hreachable, nonempty := hV }

end ExtraSurfaceDeclaration.Proofs.Theorem.ConnectedIffReachable
