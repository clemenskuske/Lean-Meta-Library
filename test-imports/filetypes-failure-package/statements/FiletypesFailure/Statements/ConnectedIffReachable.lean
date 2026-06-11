import FiletypesFailure.Statements.ConnectedGraph

namespace FiletypesFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    FiletypesFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end FiletypesFailure.Statements.ConnectedIffReachable
