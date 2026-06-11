import BuildPackagesFailure.Statements.ConnectedIffReachable

namespace BuildPackagesFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    BuildPackagesFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    exact missingIdentifier

end BuildPackagesFailure.Proofs.Statement.ConnectedIffReachable
