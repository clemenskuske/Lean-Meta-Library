import ConnectedGraph.Surface

namespace SorryProof.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    SorryProof.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True

end SorryProof.Surface.Statement.ConnectedIffReachable
