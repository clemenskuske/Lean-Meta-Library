import UnauthorizedStatementImport.Statements.ConnectedGraph
import Unauthorized.External

namespace UnauthorizedStatementImport.Statements.ConnectedIffReachable

axiom connected_iff_reachable (n : Nat) :
    UnauthorizedStatementImport.Statements.ConnectedGraph.IsConnectedGraph n ↔ True

end UnauthorizedStatementImport.Statements.ConnectedIffReachable
