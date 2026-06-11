import StatementFileContextFailure.Statements.ConnectedGraph

namespace StatementFileContextFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    StatementFileContextFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end StatementFileContextFailure.Statements.ConnectedIffReachable
