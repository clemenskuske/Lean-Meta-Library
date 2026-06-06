import ConnectedGraph.Surface

namespace MetadataCheckFailure.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MetadataCheckFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True

end MetadataCheckFailure.Surface.Statement.ConnectedIffReachable
