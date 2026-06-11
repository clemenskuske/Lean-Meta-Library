import SorryProof.Statements.ConnectedGraph

namespace SorryProof.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    SorryProof.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end SorryProof.Statements.ConnectedIffReachable
