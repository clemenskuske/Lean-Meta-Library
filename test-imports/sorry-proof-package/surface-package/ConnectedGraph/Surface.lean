import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace SorryProof.Surface.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end SorryProof.Surface.Definition.ConnectedGraph
