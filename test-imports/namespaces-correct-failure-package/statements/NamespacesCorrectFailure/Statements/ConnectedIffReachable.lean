import NamespacesCorrectFailure.Statements.ConnectedGraph

namespace NamespacesCorrectFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    NamespacesCorrectFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end NamespacesCorrectFailure.Statements.ConnectedIffReachable
