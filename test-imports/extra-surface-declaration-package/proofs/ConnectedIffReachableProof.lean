import ConnectedIffReachable.Surface

namespace ExtraSurfaceDeclaration.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end ExtraSurfaceDeclaration.Proofs.Statement.ConnectedIffReachable
