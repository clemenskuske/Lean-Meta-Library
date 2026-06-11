import FiletypesFailure.Statements.ConnectedIffReachable

namespace FiletypesFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    FiletypesFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold FiletypesFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end FiletypesFailure.Proofs.Statement.ConnectedIffReachable
