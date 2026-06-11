import BuildPackagesFailure.Statements.ConnectedGraph

namespace BuildPackagesFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    BuildPackagesFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end BuildPackagesFailure.Statements.ConnectedIffReachable
