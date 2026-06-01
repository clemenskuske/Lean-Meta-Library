import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lmlEnv } from "./project-env.js";

export function createSubmissionPackage({ cwd, slug }) {
  const packageName = `${slug.replace(/-paper$/, "")}-package`;
  const namespace = toPascal(slug);
  const root = join(cwd, packageName);

  if (existsSync(root)) {
    throw new Error(`${packageName} already exists.`);
  }

  mkdirSync(root, { recursive: true });
  write(root, "lean-toolchain", `${lmlEnv.lean.toolchain}\n`);
  write(root, "lakefile.lean", proofLakefile(namespace));
  write(root, "meta.yaml", metaYaml({ slug, namespace }));
  write(root, "abstract.tex", abstractTex());

  const surfaceRoot = join(root, "surface-package");
  mkdirSync(surfaceRoot, { recursive: true });
  write(surfaceRoot, "lean-toolchain", `${lmlEnv.lean.toolchain}\n`);
  write(surfaceRoot, "lakefile.lean", surfaceLakefile(namespace));

  write(
    surfaceRoot,
    "ConnectedGraph/latex-file.tex",
    "A connected graph is a simple graph that is connected in the sense of mathlib.\n"
  );
  write(surfaceRoot, "ConnectedGraph/surface-file.lean", connectedGraphSurface(namespace));

  write(
    surfaceRoot,
    "ConnectedIffReachable/latex-file.tex",
    "A graph is connected exactly when it has a vertex type and every pair of vertices is joined by a path.\n"
  );
  write(surfaceRoot, "ConnectedIffReachable/surface-file.lean", connectedIffReachableSurface(namespace));

  write(root, "proofs/theorem/connected-iff-reachable/proof-file.lean", connectedIffReachableProof(namespace));

  return root;
}

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function toPascal(slug) {
  return slug
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function proofLakefile(namespace) {
  return `import Lake
open Lake DSL

package ${namespace}.Proofs where

require mathlib from git
  "https://github.com/${lmlEnv.mathlib.repository}.git" @ "${lmlEnv.mathlib.branch}"

@[default_target]
lean_lib ${namespace} where
  roots := #[\`${namespace}]
`;
}

function surfaceLakefile(namespace) {
  return `import Lake
open Lake DSL

package ${namespace}.Surface where

require mathlib from git
  "https://github.com/${lmlEnv.mathlib.repository}.git" @ "${lmlEnv.mathlib.branch}"

@[default_target]
lean_lib ${namespace} where
  roots := #[\`${namespace}]
`;
}

function metaYaml({ slug, namespace }) {
  return `pinnedLeanToolchain: ${lmlEnv.lean.toolchain}
proofLakefileUrl: .
paperTitle: Your Submission Paper
namespaceSlug: ${slug}
surfaceLakefilePath: surface-package/lakefile.lean
abstractUrl: abstract.tex
surfaceEntries:
  - type: Definition
    name: ${namespace}.Surface.Definition.ConnectedGraph
    folder: surface-package/ConnectedGraph
    usedSurfaceFiles: []
  - type: Theorem
    name: ${namespace}.Surface.Theorem.ConnectedIffReachable
    folder: surface-package/ConnectedIffReachable
    usedSurfaceFiles:
      - githubRepo: clemenskuske/lean-meta-library
        slug: ${slug}
        surfaceFile: surface-package/ConnectedGraph/surface-file.lean
        definition: ${namespace}.Surface.Definition.ConnectedGraph.IsConnectedGraph
proofs:
  - theorem: ${namespace}.Surface.Theorem.ConnectedIffReachable.connected_iff_reachable
    proofFile: proofs/theorem/connected-iff-reachable/proof-file.lean
bibtex: ""
paper:
  paperTitle: Your Submission Paper
  arxivUrl: ""
  onlineSource: ""
  doi: ""
  orcids: []
  journalOrConference: ""
  keywords: []
`;
}

function abstractTex() {
  return `This submission records a minimal surface statement about connected simple graphs in mathlib.
`;
}

function connectedGraphSurface(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace ${namespace}.Surface.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end ${namespace}.Surface.Definition.ConnectedGraph
`;
}

function connectedIffReachableSurface(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Surface.Definition.ConnectedGraph

namespace ${namespace}.Surface.Theorem.ConnectedIffReachable

open ${namespace}.Surface.Definition.ConnectedGraph

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    IsConnectedGraph G ↔ Nonempty V ∧ ∀ u v : V, G.Reachable u v

end ${namespace}.Surface.Theorem.ConnectedIffReachable
`;
}

function connectedIffReachableProof(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Surface.Definition.ConnectedGraph
import ${namespace}.Surface.Theorem.ConnectedIffReachable

namespace ${namespace}.Proofs.Theorem.ConnectedIffReachable

open ${namespace}.Surface.Definition.ConnectedGraph

theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    IsConnectedGraph G ↔ Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  ${namespace}.Surface.Theorem.ConnectedIffReachable.connected_iff_reachable G

end ${namespace}.Proofs.Theorem.ConnectedIffReachable
`;
}
