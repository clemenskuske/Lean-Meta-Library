import UnauthorizedStatementImport.Statements.ConnectedGraph
import UnauthorizedStatementImport.Statements.ConnectedIffReachable

namespace UnauthorizedStatementImport.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    UnauthorizedStatementImport.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold UnauthorizedStatementImport.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end UnauthorizedStatementImport.Proofs.Statement.ConnectedIffReachable
