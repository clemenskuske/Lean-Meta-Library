import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace TestPaper.Surface.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end TestPaper.Surface.Definition.ConnectedGraph
