import ManifestCheckFailure.Statements.ConnectedGraph

namespace ManifestCheckFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    ManifestCheckFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end ManifestCheckFailure.Statements.ConnectedIffReachable
