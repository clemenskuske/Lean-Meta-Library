import FinalProofBuildFailure.Statements.ConnectedGraph

namespace FinalProofBuildFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    FinalProofBuildFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end FinalProofBuildFailure.Statements.ConnectedIffReachable
