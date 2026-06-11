import MathlibVersionFailure.Statements.ConnectedGraph

namespace MathlibVersionFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MathlibVersionFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end MathlibVersionFailure.Statements.ConnectedIffReachable
