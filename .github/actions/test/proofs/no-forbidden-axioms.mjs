#!/usr/bin/env node
// Builds the proof package, then inspects the axiom dependencies of each manifest
// proof theorem. Submitted proof targets may not depend on sorryAx or on local
// proof-namespace axioms.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadContext } from "../general/manifest-context.mjs";
import {
  isLeanName,
  maxBuildOutputBytes,
  proofPackageRoot,
  report
} from "../common.mjs";
import { builtModuleNames } from "../lake-config.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { augmentProofLakefile } from "./augment-proof-lakefile.mjs";

const { packageRoot, manifest, namespaceRoot } = loadContext();
const errors = [];
const warnings = [];
const proofs = Array.isArray(manifest.proofs) ? manifest.proofs : [];
const pPkgRoot = proofPackageRoot(manifest);
const proofRoot = pPkgRoot ? resolve(packageRoot, pPkgRoot) : null;

augmentProofLakefile({ packageRoot, manifest, errors, warnings });
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: pPkgRoot ? join(pPkgRoot, "lakefile.lean") : null,
  kind: "proof",
  label: "proof package",
  errors,
  warnings
});

checkCompiledProofAxioms();

function checkCompiledProofAxioms() {
  if (!proofRoot) {
    errors.push("proof package is required to inspect proof axiom dependencies");
    return;
  }

  const proofTargets = [];
  for (const proof of proofs) {
    const proofName = proof?.proof;
    if (!isLeanName(proofName)) {
      errors.push(`proof manifest entry is missing a valid proof name: ${proofName ?? "(missing)"}`);
      continue;
    }
    proofTargets.push(proofName);
  }

  if (proofTargets.length === 0) {
    return;
  }

  const proofModules = builtModuleNames(proofRoot).filter(isLeanName);
  if (proofModules.length === 0) {
    errors.push("no built proof modules were found to inspect proof axiom dependencies");
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-axioms-"));
  const inspector = join(tmp, "ProofAxiomInspect.lean");

  try {
    writeFileSync(inspector, proofAxiomInspector({ proofModules, proofTargets }), "utf8");
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

function proofAxiomInspector({ proofModules, proofTargets }) {
  const importLines = [...proofModules].sort().map((moduleName) => `import ${moduleName}`);
  const forbiddenPrefixes = namespaceRoot ? [`${namespaceRoot}.Proofs`] : [];
  const forbiddenPrefixArray = leanNameArray(forbiddenPrefixes);
  const proofTargetArray = leanNameArray(proofTargets);

  return `import Lean
import Lean.Util.CollectAxioms
${importLines.join("\n")}

open Lean

def forbiddenExactAxioms : Array Name := #[\`sorryAx]
def forbiddenAxiomPrefixes : Array Name := ${forbiddenPrefixArray}
def proofAxiomChecks : Array Name := ${proofTargetArray}

def isForbiddenAxiom (name : Name) : Bool :=
  forbiddenExactAxioms.contains name ||
    forbiddenAxiomPrefixes.any (fun pre => pre.isPrefixOf name)

#eval show CoreM Unit from do
  let mut failed := false
  for proofName in proofAxiomChecks do
    let axioms <- collectAxioms proofName
    for ax in axioms do
      if isForbiddenAxiom ax then
        IO.eprintln s!"FORBIDDEN_AXIOM\\t{proofName}\\t{ax}"
        failed := true
  if failed then
    throwError "compiled proof theorem depends on forbidden axioms"
`;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

report("proof forbidden axioms", errors, warnings);
