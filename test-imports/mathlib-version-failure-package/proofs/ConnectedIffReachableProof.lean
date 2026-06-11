import MathlibVersionFailure.Statements.ConnectedIffReachable

namespace MathlibVersionFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    MathlibVersionFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold MathlibVersionFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end MathlibVersionFailure.Proofs.Statement.ConnectedIffReachable
