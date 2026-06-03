import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace MismatchedProofType.Surface.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end MismatchedProofType.Surface.Definition.ConnectedGraph
