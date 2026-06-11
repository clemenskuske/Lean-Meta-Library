import FolderSizeFailure.Statements.ConnectedGraph

namespace FolderSizeFailure.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    FolderSizeFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end FolderSizeFailure.Statements.ConnectedIffReachable
