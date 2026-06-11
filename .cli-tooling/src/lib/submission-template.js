import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lmlEnv } from "./project-env.js";

export function createSubmissionPackage({ cwd, slug }) {
  const packageName = `${slug.replace(/-paper$/, "")}-package`;
  const namespace = toPascal(slug);
  const mathlib = lmlEnv.baseImports.Mathlib;
  const leanToolchain = leanToolchainFromVersion(lmlEnv.lean?.version);
  const root = join(cwd, packageName);

  if (existsSync(root)) {
    throw new Error(`${packageName} already exists.`);
  }

  mkdirSync(root, { recursive: true });
  write(root, "lean-toolchain", `${leanToolchain}\n`);
  write(root, "lakefile.lean", proofLakefile(namespace, mathlib));
  write(root, "meta.yaml", metaYaml({ slug, namespace }));
  write(root, "abstract.tex", abstractTex());

  const statementsRoot = join(root, "statements");
  mkdirSync(statementsRoot, { recursive: true });
  write(statementsRoot, "lean-toolchain", `${leanToolchain}\n`);
  write(statementsRoot, "lakefile.lean", statementLakefile(namespace, mathlib));
  write(statementsRoot, `${namespace}/Statements/ConnectedGraph.lean`, connectedGraphStatement(namespace));
  write(statementsRoot, `${namespace}/Statements/ConnectedGraph.tex`, "A connected graph is a simple graph that is connected in the sense of mathlib.\n");
  write(statementsRoot, `${namespace}/Statements/ConnectedIffReachable.lean`, connectedIffReachableStatement(namespace));
  write(statementsRoot, `${namespace}/Statements/ConnectedIffReachable.tex`, "A graph is connected exactly when it has a vertex type and every pair of vertices is joined by a path.\n");

  write(root, `${namespace}/Proofs/ConnectedIffReachableProof.lean`, connectedIffReachableProof(namespace));

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

function leanToolchainFromVersion(version) {
  const normalized = String(version ?? "").trim();
  return normalized ? `leanprover/lean4:${normalized}` : "";
}

function proofLakefile(namespace, mathlib) {
  return `import Lake
open Lake DSL

package ${namespace}.Proofs where

require mathlib from git
  "https://github.com/${mathlib.repository}.git" @ "${mathlib.revision}"

require ${namespace}.Statements from "./statements"

@[default_target]
lean_lib ${namespace}.Proofs where
  roots := #[\`${namespace}.Proofs.ConnectedIffReachableProof]
`;
}

function statementLakefile(namespace, mathlib) {
  return `import Lake
open Lake DSL

package ${namespace}.Statements where

require mathlib from git
  "https://github.com/${mathlib.repository}.git" @ "${mathlib.revision}"

@[default_target]
lean_lib ${namespace}.Statements where
  roots := #[\`${namespace}.Statements.ConnectedGraph, \`${namespace}.Statements.ConnectedIffReachable]
`;
}

function metaYaml({ slug, namespace }) {
  return `proofLakefilePath: lakefile.lean
proofLeanToolchainPath: lean-toolchain
statementLakefilePath: statements/lakefile.lean
statementLeanToolchainPath: statements/lean-toolchain
abstractPath: abstract.tex
submissionTitle: Your Submission Paper
submissionSlug: ${slug}
statements:
  - Name: ConnectedGraph
    Type: Definition
    Statement:
      CurrentSubmission: true
      Name: ${namespace}.Definition.ConnectedGraph.IsConnectedGraph
      LeanStatement: statements/${namespace}/Statements/ConnectedGraph.lean
      LatexDefinition: statements/${namespace}/Statements/ConnectedGraph.tex
    DeclarationReferences: []
  - Name: ConnectedIffReachable
    Type: Axiom
    Statement:
      CurrentSubmission: true
      Name: ${namespace}.Axiom.ConnectedIffReachable.connected_iff_reachable
      LeanStatement: statements/${namespace}/Statements/ConnectedIffReachable.lean
      LatexDefinition: statements/${namespace}/Statements/ConnectedIffReachable.tex
    DeclarationReferences: []
proofs:
  - Name: ConnectedIffReachableProof
    Type: proof
    Theorem:
      CurrentSubmission: true
      LeanStatement: statements/${namespace}/Statements/ConnectedIffReachable.lean
      LatexDefinition: statements/${namespace}/Statements/ConnectedIffReachable.tex
      Name: ${namespace}.Axiom.ConnectedIffReachable.connected_iff_reachable
    Proof:
      File: ${namespace}/Proofs/ConnectedIffReachableProof.lean
      Name: ${namespace}.Proofs.ConnectedIffReachable.connected_iff_reachable
    DeclarationReferences: []
bibtex-entries: []
`;
}

function abstractTex() {
  return `This submission records a minimal statement about connected simple graphs in mathlib.
`;
}

function connectedGraphStatement(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace ${namespace}.Definition.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end ${namespace}.Definition.ConnectedGraph
`;
}

function connectedIffReachableStatement(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Statements.ConnectedGraph

namespace ${namespace}.Axiom.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ${namespace}.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end ${namespace}.Axiom.ConnectedIffReachable
`;
}

function connectedIffReachableProof(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Statements.ConnectedIffReachable

namespace ${namespace}.Proofs.ConnectedIffReachable

theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ${namespace}.Definition.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  by
    unfold ${namespace}.Definition.ConnectedGraph.IsConnectedGraph
    constructor
    · intro h
      exact ⟨h.nonempty, h.preconnected⟩
    · rintro ⟨hV, hreachable⟩
      exact { preconnected := hreachable, nonempty := hV }

end ${namespace}.Proofs.ConnectedIffReachable
`;
}
