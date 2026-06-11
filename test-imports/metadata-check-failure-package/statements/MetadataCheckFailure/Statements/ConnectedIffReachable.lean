import MetadataCheckFailure.Statements.ConnectedGraph

namespace MetadataCheckFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MetadataCheckFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end MetadataCheckFailure.Statements.ConnectedIffReachable
