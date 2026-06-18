import ManifestDiskStateFailure.Statements.ConnectedGraph

namespace ManifestDiskStateFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    ManifestDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end ManifestDiskStateFailure.Statements.ConnectedIffReachable
