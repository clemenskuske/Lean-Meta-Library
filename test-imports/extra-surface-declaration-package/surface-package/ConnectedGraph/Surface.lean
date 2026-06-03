import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end ExtraSurfaceDeclaration.Surface.Definition.ConnectedGraph
