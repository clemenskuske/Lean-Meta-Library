import MetadataDiskStateFailure.Statements.ConnectedGraph

namespace MetadataDiskStateFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MetadataDiskStateFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end MetadataDiskStateFailure.Statements.ConnectedIffReachable
