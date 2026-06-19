#!/usr/bin/env node
// Builds the proof package, then inspects the axiom dependencies of each manifest
// proof theorem. Submitted proof targets may not depend on sorryAx, local
// proof-namespace axioms, or undeclared non-base axioms.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
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
const configuredAllowedMathlibAxioms = (lmlEnv.checks?.allowedMathlibAxioms ?? []).map(String);
const allowedMathlibAxioms = configuredAllowedMathlibAxioms.filter(isLeanName);
const invalidAllowedMathlibAxioms = configuredAllowedMathlibAxioms.filter((name) => !isLeanName(name));

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
  if (proofs.length === 0) {
    return;
  }
  if (!proofRoot) {
    errors.push("proof package is required to inspect proof axiom dependencies");
    return;
  }
  if (invalidAllowedMathlibAxioms.length > 0) {
    errors.push(`lml-env.json checks.allowedMathlibAxioms contains invalid Lean names: ${invalidAllowedMathlibAxioms.join(", ")}`);
    return;
  }

  const proofChecks = [];
  for (const proof of proofs) {
    const proofName = proof?.proof;
    if (!isLeanName(proofName)) {
      errors.push(`proof manifest entry is missing a valid proof name: ${proofName ?? "(missing)"}`);
      continue;
    }
    const deps = Array.isArray(proof?.deps) ? proof.deps : [];
    const invalidDeps = deps.filter((dep) => !isLeanName(dep));
    for (const dep of invalidDeps) {
      errors.push(`proof manifest entry ${proofName} has invalid ProofObligations name: ${dep ?? "(missing)"}`);
    }
    proofChecks.push({
      proof: proofName,
      deps: deps.filter(isLeanName)
    });
  }

  if (proofChecks.length === 0) {
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
    writeFileSync(inspector, proofAxiomInspector({ proofModules, proofChecks, allowedMathlibAxioms }), "utf8");
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

function proofAxiomInspector({ proofModules, proofChecks, allowedMathlibAxioms }) {
  const importLines = [...proofModules].sort().map((moduleName) => `import ${moduleName}`);
  const forbiddenPrefixes = namespaceRoot ? [`${namespaceRoot}.Proofs`] : [];
  const forbiddenPrefixArray = leanNameArray(forbiddenPrefixes);
  const proofCheckArray = leanProofCheckArray(proofChecks);
  const allowedBaseAxiomArray = leanNameArray(allowedMathlibAxioms);

  return `import Lean
import Lean.Util.CollectAxioms
${importLines.join("\n")}

open Lean

def forbiddenExactAxioms : Array Name := #[\`sorryAx]
def forbiddenAxiomPrefixes : Array Name := ${forbiddenPrefixArray}
def allowedBaseAxioms : Array Name := ${allowedBaseAxiomArray}

structure ProofAxiomCheck where
  proof : Name
  deps : Array Name

def proofAxiomChecks : Array ProofAxiomCheck := ${proofCheckArray}

def sameAxiomType (candidate allowed : ConstantInfo) : CoreM Bool := do
  if candidate.levelParams.length != allowed.levelParams.length then
    return false
  let levels := (List.range candidate.levelParams.length).map (fun index => Level.param (Name.mkSimple s!"u{index}"))
  let candidateType := candidate.type.instantiateLevelParams candidate.levelParams levels
  let allowedType := allowed.type.instantiateLevelParams allowed.levelParams levels
  Meta.MetaM.run' do
    Meta.isExprDefEq candidateType allowedType

def isAllowedBaseAxiomByNameAndType (name : Name) : CoreM Bool := do
  let info <- getConstInfo name
  match info with
  | .axiomInfo _ =>
      for allowedName in allowedBaseAxioms do
        if name == allowedName then
          let allowedInfo <- getConstInfo allowedName
          if (← sameAxiomType info allowedInfo) then
            return true
      return false
  | _ => return false

def isForbiddenAxiom (name : Name) : Bool :=
  forbiddenExactAxioms.contains name ||
    forbiddenAxiomPrefixes.any (fun pre => pre.isPrefixOf name)

def isAllowedDeclaredAxiom (entry : ProofAxiomCheck) (name : Name) : CoreM Bool := do
  if (← isAllowedBaseAxiomByNameAndType name) then
    return true
  return entry.deps.contains name

#eval show CoreM Unit from do
  let mut failed := false
  for entry in proofAxiomChecks do
    let axioms <- collectAxioms entry.proof
    for ax in axioms do
      if isForbiddenAxiom ax then
        IO.eprintln s!"FORBIDDEN_AXIOM\\t{entry.proof}\\t{ax}"
        failed := true
      else if !(← isAllowedDeclaredAxiom entry ax) then
        IO.eprintln s!"UNDECLARED_AXIOM\\t{entry.proof}\\t{ax}"
        failed := true
  if failed then
    throwError "compiled proof theorem depends on forbidden axioms"
`;
}

function leanProofCheckArray(entries) {
  return `#[${entries.map((entry) => `{ proof := \`${entry.proof}, deps := ${leanNameArray(entry.deps)} }`).join(", ")}]`;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

report("proof forbidden axioms", errors, warnings);
