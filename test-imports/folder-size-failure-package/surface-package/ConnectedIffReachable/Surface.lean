import ConnectedGraph.Surface

namespace FolderSizeFailure.Surface.Statement.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    FolderSizeFailure.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True

end FolderSizeFailure.Surface.Statement.ConnectedIffReachable
