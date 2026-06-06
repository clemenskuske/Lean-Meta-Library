import ConnectedIffReachable.Surface

namespace NamespacesCorrectFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    NamespacesCorrectFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold NamespacesCorrectFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end NamespacesCorrectFailure.Proofs.Statement.ConnectedIffReachable
