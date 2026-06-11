import MissingProofFile.Statements.ConnectedGraph

namespace MissingProofFile.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MissingProofFile.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end MissingProofFile.Statements.ConnectedIffReachable
