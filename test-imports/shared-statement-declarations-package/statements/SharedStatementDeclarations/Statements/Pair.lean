namespace SharedStatementDeclarations.Statements.Pair

def first (n : Nat) : Prop :=
  n = n

axiom second (n : Nat) : first n

end SharedStatementDeclarations.Statements.Pair
