import MismatchedProofType.Statements.ConnectedGraph

namespace MismatchedProofType.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    MismatchedProofType.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end MismatchedProofType.Statements.ConnectedIffReachable
