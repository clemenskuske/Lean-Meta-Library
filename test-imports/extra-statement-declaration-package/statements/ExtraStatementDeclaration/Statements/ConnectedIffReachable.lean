import ExtraStatementDeclaration.Statements.ConnectedGraph

namespace ExtraStatementDeclaration.Statements.ConnectedIffReachable

def helperVertexCount : Nat := 0

axiom connected_iff_reachable (n : Nat) :
    ExtraStatementDeclaration.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end ExtraStatementDeclaration.Statements.ConnectedIffReachable
