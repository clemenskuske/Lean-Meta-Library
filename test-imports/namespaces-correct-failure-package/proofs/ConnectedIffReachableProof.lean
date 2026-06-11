import NamespacesCorrectFailure.Statements.ConnectedIffReachable

namespace NamespacesCorrectFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    NamespacesCorrectFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold NamespacesCorrectFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end NamespacesCorrectFailure.Proofs.Statement.ConnectedIffReachable
