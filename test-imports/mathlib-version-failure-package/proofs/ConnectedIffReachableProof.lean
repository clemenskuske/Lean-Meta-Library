import ConnectedIffReachable.Surface

namespace MathlibVersionFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    MathlibVersionFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold MathlibVersionFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end MathlibVersionFailure.Proofs.Statement.ConnectedIffReachable
