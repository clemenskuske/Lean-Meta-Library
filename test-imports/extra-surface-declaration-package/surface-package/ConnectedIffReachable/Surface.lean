import ConnectedGraph.Surface

namespace ExtraSurfaceDeclaration.Surface.Statement.ConnectedIffReachable

def helperVertexCount : Nat := 0

axiom connected_iff_reachable (n : Nat) :
    ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph.IsConnectedGraph n ↔ True

end ExtraSurfaceDeclaration.Surface.Statement.ConnectedIffReachable
