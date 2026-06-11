#!/usr/bin/env node
// Elaborates metadata proof files, then checks submitted proof theorem axiom dependencies.
// Submitted proof targets may not depend on sorryAx or local proof axioms.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContext } from "../general/meta-context.mjs";
import {
  isLeanName,
  maxBuildOutputBytes,
  packageRootForLakefile,
  proofLakefilePath,
  relativePath,
  report
} from "../common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "../lake-config.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { augmentProofLakefile } from "./augment-proof-lakefile.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const warnings = [];
const proofs = Array.isArray(meta.proofs) ? meta.proofs : [];
const proofRoot = proofLakefilePath(meta) ? packageRootForLakefile(packageRoot, proofLakefilePath(meta)) : null;

augmentProofLakefile({ packageRoot, meta, errors, warnings });
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: proofLakefilePath(meta),
  kind: "proof",
  label: "proof package",
  errors,
  warnings
});

const rootLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;
const proofFiles = new Set(
  proofs
    .map(proofFileForEntry)
    .filter(Boolean)
    .map((proofFile) => join(packageRoot, proofFile))
);

for (const file of proofFiles) {
  const label = relativePath(packageRoot, file);

  if (!proofRoot) {
    errors.push(`proof lakefile is required to elaborate proof file ${label}`);
    continue;
  }

  const result = spawnSync("lake", ["--dir", proofRoot, "lean", file], {
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

  for (const proof of proofs) {
    const proofFile = proofFileForEntry(proof);
    const proofModule = proofRoot
      ? lakeModuleForFile(rootLakeConfig, proofRoot, join(packageRoot, proofFile ?? ""))
      : null;
    const proofName = proofNameForEntry(proof);

    if (!proofFile || !proofModule || !isLeanName(proofModule)) {
      errors.push(`could not infer proof module for ${proofFile ?? "(missing Proof.File)"}`);
      continue;
    }
    if (!isLeanName(proofName)) {
      errors.push(`proof metadata entry is missing a valid proof theorem name: ${proofName ?? "(missing)"}`);
      continue;
    }

    proofImports.add(proofModule);
    proofTargets.push({
      label: proofFile,
      name: proofName
    });
  }

  if (proofTargets.length === 0 || !proofRoot) {
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-axioms-"));
  const inspector = join(tmp, "ProofAxiomInspect.lean");

  try {
    writeFileSync(inspector, proofAxiomInspector({ proofImports, proofTargets }), "utf8");
    const result = spawnSync("lake", ["--dir", proofRoot, "lean", inspector], {
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
  const forbiddenPrefixes = namespaceRoot ? [`${namespaceRoot}.Proofs`] : [];
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

function proofFileForEntry(proof) {
  return proof?.Proof?.File ?? null;
}

function proofNameForEntry(proof) {
  return proof?.Proof?.Name ?? null;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

function leanString(value) {
  return JSON.stringify(String(value ?? ""));
}

report("proof forbidden axioms", errors, warnings);
