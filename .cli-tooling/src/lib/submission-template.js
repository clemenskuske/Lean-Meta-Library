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
  write(root, "manifest.yaml", manifestYaml({ slug, namespace, lmlEnv }));
  write(root, "abstract.tex", abstractTex());
  write(root, "LICENSE", apacheLicense());

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

function manifestYaml({ slug, namespace, lmlEnv }) {
  return `manifestVersion: "1"
leanVersion: ${lmlEnv.lean?.version ?? ""}
mathlibVersion: ${lmlEnv.baseImports?.Mathlib?.revision ?? ""}
AbstractPath: abstract.tex
LicenseFile: LICENSE
SubmissionName: Your Submission Paper
SubmissionSlug: ${slug}
BibEntries: []
StatementSubmissions:
  rootFolder: statements
  statements:
    - Name: ${namespace}.Statements.ConnectedGraph.IsConnectedGraph
      Type: Definition
    - Name: ${namespace}.Statements.ConnectedIffReachable.connected_iff_reachable
      Type: Axiom
ProofSubmissions:
  rootFolder: "."
  proofs:
    - Name: ${namespace}.Proofs.ConnectedIffReachable.connected_iff_reachable
      AxiomReference: ${namespace}.Statements.ConnectedIffReachable.connected_iff_reachable
`;
}

function abstractTex() {
  return `This submission records a minimal statement about connected simple graphs in mathlib.
`;
}

function apacheLicense() {
  return `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright [YEAR] [AUTHOR]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`;
}

function connectedGraphStatement(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected

namespace ${namespace}.Statements.ConnectedGraph

def IsConnectedGraph {V : Type u} (G : SimpleGraph V) : Prop :=
  G.Connected

end ${namespace}.Statements.ConnectedGraph
`;
}

function connectedIffReachableStatement(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Statements.ConnectedGraph

namespace ${namespace}.Statements.ConnectedIffReachable

axiom connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ${namespace}.Statements.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v

end ${namespace}.Statements.ConnectedIffReachable
`;
}

function connectedIffReachableProof(namespace) {
  return `import Mathlib.Combinatorics.SimpleGraph.Connectivity.Connected
import ${namespace}.Statements.ConnectedIffReachable

namespace ${namespace}.Proofs.ConnectedIffReachable

theorem connected_iff_reachable {V : Type u} (G : SimpleGraph V) :
    ${namespace}.Statements.ConnectedGraph.IsConnectedGraph G ↔
      Nonempty V ∧ ∀ u v : V, G.Reachable u v :=
  by
    unfold ${namespace}.Statements.ConnectedGraph.IsConnectedGraph
    constructor
    · intro h
      exact ⟨h.nonempty, h.preconnected⟩
    · rintro ⟨hV, hreachable⟩
      exact { preconnected := hreachable, nonempty := hV }

end ${namespace}.Proofs.ConnectedIffReachable
`;
}
