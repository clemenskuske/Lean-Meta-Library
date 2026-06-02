#!/usr/bin/env node
// Scans proof files for local placeholders, asks Lean to elaborate them, then checks compiled proof theorem axiom dependencies.
// Submitted proof theorems may not depend on sorryAx, local proof axioms, or same-submission surface axioms.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declarationNames,
  isConjectureProofEntry,
  loadContext,
  maxBuildOutputBytes,
  proofConstantForTheorem,
  proofNamespaceForTheorem,
  readIfExists,
  relativePath,
  report,
  stripLeanCommentsAndStrings,
  walkFiles
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const rootLakeConfig = loadLakeConfig(packageRoot, "root lakefile", errors);
const proofFiles = new Set(
  (meta.proofs ?? [])
    .map((proof) => proof.proofFile)
    .filter(Boolean)
    .map((proofFile) => join(packageRoot, proofFile))
);

for (const file of walkFiles(join(packageRoot, "proofs")).filter((path) => path.endsWith(".lean"))) {
  proofFiles.add(file);
}

for (const file of proofFiles) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }
  const label = relativePath(packageRoot, file);
  const stripped = stripLeanCommentsAndStrings(source);
  if (/\bsorry\b/.test(stripped)) {
    errors.push(`proof file contains local sorry: ${label}`);
  }
  if (/\badmit\b/.test(stripped)) {
    errors.push(`proof file contains local admit: ${label}`);
  }
  if (/\bunsafe\b/.test(stripped)) {
    errors.push(`proof file contains local unsafe: ${label}`);
  }
  if (declarationNames(stripped, "axiom").length > 0) {
    errors.push(`proof file declares local axioms: ${label}`);
  }

  const result = spawnSync("lake", ["--dir", packageRoot, "lean", file], {
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`could not run lake lean for ${label}: ${result.error.message}`);
    continue;
  }

  if (result.status !== 0) {
    errors.push(`Lean failed to elaborate proof file ${label}\n${result.stdout}${result.stderr}`.trim());
  }
}

checkCompiledProofAxioms();

function checkCompiledProofAxioms() {
  const proofImports = new Set();
  const proofTargets = [];

  for (const proof of (meta.proofs ?? []).filter((item) => !isConjectureProofEntry(item))) {
    const proofModule = lakeModuleForFile(rootLakeConfig, packageRoot, proof.proofFile);
    const proofNamespace = proofNamespaceForTheorem(proof.theorem ?? "");
    const proofConstant = proofConstantForTheorem(proof.theorem ?? "");

    if (!proof.proofFile || !proofModule || !isLeanName(proofModule)) {
      errors.push(`could not infer proof module for ${proof.proofFile ?? "(missing proofFile)"}`);
      continue;
    }
    if (!proofNamespace || !proofConstant) {
      errors.push(`could not infer proof theorem name for ${proof.theorem ?? "(missing theorem)"}`);
      continue;
    }

    proofImports.add(proofModule);
    proofTargets.push({
      label: proof.proofFile,
      name: `${proofNamespace}.${proofConstant}`
    });
  }

  if (proofTargets.length === 0) {
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-axioms-"));
  const inspector = join(tmp, "ProofAxiomInspect.lean");

  try {
    writeFileSync(inspector, proofAxiomInspector({ proofImports, proofTargets }), "utf8");
    const result = spawnSync("lake", ["--dir", packageRoot, "lean", inspector], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean proof axiom dependency check: ${result.error.message}`);
      return;
    }
    if (result.status !== 0) {
      errors.push(`compiled proof theorem depends on forbidden axioms\n${result.stdout}${result.stderr}`.trim());
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function proofAxiomInspector({ proofImports, proofTargets }) {
  const importLines = [...proofImports].sort().map((moduleName) => `import ${moduleName}`);
  const forbiddenPrefixes = namespaceRoot ? [`${namespaceRoot}.Proofs`, `${namespaceRoot}.Surface`] : [];
  const forbiddenPrefixArray = leanNameArray(forbiddenPrefixes);
  const proofTargetArray = `#[${
    proofTargets
      .map((target) => `(\`${target.name}, ${leanString(target.label)})`)
      .join(", ")
  }]`;

  return `import Lean
import Lean.Util.CollectAxioms
${importLines.join("\n")}

open Lean

def forbiddenExactAxioms : Array Name := #[\`sorryAx]
def forbiddenAxiomPrefixes : Array Name := ${forbiddenPrefixArray}
def proofAxiomChecks : Array (Name × String) := ${proofTargetArray}

def isForbiddenAxiom (name : Name) : Bool :=
  forbiddenExactAxioms.contains name ||
    forbiddenAxiomPrefixes.any (fun pre => pre.isPrefixOf name)

#eval show CoreM Unit from do
  let mut failed := false
  for (proofName, label) in proofAxiomChecks do
    let axioms <- collectAxioms proofName
    for ax in axioms do
      if isForbiddenAxiom ax then
        IO.eprintln s!"FORBIDDEN_AXIOM\\t{label}\\t{proofName}\\t{ax}"
        failed := true
  if failed then
    throwError "compiled proof theorem depends on forbidden axioms"
`;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

function leanString(value) {
  return JSON.stringify(String(value ?? ""));
}

function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(name);
}

report("proof axioms and sorrys", errors);
