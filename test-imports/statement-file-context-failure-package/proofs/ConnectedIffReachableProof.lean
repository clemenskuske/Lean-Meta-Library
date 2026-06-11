import StatementFileContextFailure.Statements.ConnectedIffReachable

namespace StatementFileContextFailure.Proofs.Statement.ConnectedIffReachable

theorem connected_iff_reachable (n : Nat) :
    StatementFileContextFailure.Statements.ConnectedGraph.IsConnectedGraph n ↔ True :=
  by
    unfold StatementFileContextFailure.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro _h
      trivial
    · intro _h
      rfl

end StatementFileContextFailure.Proofs.Statement.ConnectedIffReachable
