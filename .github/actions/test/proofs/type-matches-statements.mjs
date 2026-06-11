#!/usr/bin/env node
// Checks that proof metadata targets statement axioms and that proof theorem types match those statements.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { loadContext, slugToPascal } from "../general/meta-context.mjs";
import {
  isLeanName,
  maxBuildOutputBytes,
  packageRootForLakefile,
  proofLakefilePath,
  report,
  statementLakefilePath
} from "../common.mjs";
import { lakeDependencies, lakeModuleForFile, loadLakeConfig } from "../lake-config.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { augmentProofLakefile } from "./augment-proof-lakefile.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];
const statements = Array.isArray(meta.statements) ? meta.statements : [];
const proofs = Array.isArray(meta.proofs) ? meta.proofs : [];
const proofRoot = proofLakefilePath(meta) ? packageRootForLakefile(packageRoot, proofLakefilePath(meta)) : null;
const statementRoot = statementLakefilePath(meta) ? packageRootForLakefile(packageRoot, statementLakefilePath(meta)) : null;

ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: statementLakefilePath(meta),
  kind: "statement",
  label: "statement package",
  errors,
  warnings
});
augmentProofLakefile({ packageRoot, meta, errors, warnings });
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: proofLakefilePath(meta),
  kind: "proof",
  label: "proof package",
  errors,
  warnings
});

const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;
const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement lakefile", errors) : null;
const proofDependencies = proofLakeConfig ? lakeDependencies(proofLakeConfig) : [];
const externalLakeConfigs = new Map();
const proofByTheorem = new Map();

for (const proof of proofs) {
  const theoremName = theoremNameForProof(proof);
  if (!theoremName) {
    continue;
  }
  if (proofByTheorem.has(theoremName)) {
    errors.push(`multiple proof metadata entries target statement ${theoremName}`);
    continue;
  }
  proofByTheorem.set(theoremName, proof);
}

for (const statement of statements.filter((entry) => entry.Type === "Axiom")) {
  const statementName = statement?.Statement?.Name;
  if (!statementName) {
    continue;
  }
  const proof = proofByTheorem.get(statementName);
  if (!proof || !isCurrentTheoremReference(proof.Theorem)) {
    errors.push(`statement axiom has no matching proof metadata entry: ${statementName}`);
  }
}

for (const proof of proofs) {
  checkProofEntry(proof);
}

function checkProofEntry(proof) {
  const theorem = proof?.Theorem ?? {};
  const theoremName = theorem.Name;
  const proofFile = proof?.Proof?.File;
  const proofName = proof?.Proof?.Name;

  if (!isLeanName(theoremName)) {
    errors.push(`proof metadata entry is missing a valid Theorem.Name: ${theoremName ?? "(missing)"}`);
    return;
  }
  if (!isLeanName(proofName)) {
    errors.push(`proof metadata entry for ${theoremName} is missing a valid Proof.Name: ${proofName ?? "(missing)"}`);
    return;
  }
  if (isCurrentTheoremReference(theorem) && !currentStatementAxiomNames().has(theoremName)) {
    errors.push(`proof metadata targets current-submission statement axiom not listed in metadata: ${theoremName}`);
    return;
  }

  const proofModule = proofRoot && proofFile
    ? lakeModuleForFile(proofLakeConfig, proofRoot, join(packageRoot, proofFile))
    : null;
  if (!proofRoot || !proofLakeConfig || !proofModule) {
    errors.push(`could not infer proof module for ${proofFile ?? "(missing proof file)"}`);
    return;
  }

  const theoremModule = theoremModuleForReference(theorem);
  if (isCurrentTheoremReference(theorem) && !theoremModule) {
    errors.push(`could not infer statement module for ${theorem.LeanStatement ?? "(missing statement file)"}`);
    return;
  }
  if (theorem.SubmissionSlug && !isCurrentTheoremReference(theorem) && !theoremModule) {
    errors.push(`could not infer external statement module for ${theorem.SubmissionSlug}:${theorem.LeanStatement ?? "(missing statement file)"}`);
    return;
  }

  checkProofType({ theoremName, theoremModule, proofName, proofModule, proofFile });
}

function theoremModuleForReference(theorem) {
  if (isCurrentTheoremReference(theorem)) {
    return statementRoot && theorem.LeanStatement
      ? lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, theorem.LeanStatement))
      : null;
  }
  if (!theorem?.SubmissionSlug) {
    return null;
  }
  return externalStatementModuleForReference(theorem);
}

function externalStatementModuleForReference(reference) {
  const dependencyName = `${slugToPascal(reference.SubmissionSlug)}.Statements`;
  const dependency = proofDependencies.find((item) => item.name === dependencyName);
  if (!dependency) {
    errors.push(`proof lakefile must declare statement dependency ${dependencyName} for theorem reference ${reference.Name}`);
    return null;
  }

  const packageDir = dependencyPackageDir(dependency);
  if (!packageDir || !existsSync(packageDir)) {
    errors.push(`could not find checked-out package for proof dependency ${dependencyName}`);
    return null;
  }

  const config = externalLakeConfig(packageDir, dependencyName);
  if (!config) {
    return null;
  }

  for (const candidate of referencePathCandidates(reference.LeanStatement, dependency)) {
    const moduleName = lakeModuleForFile(config, packageDir, candidate);
    if (moduleName) {
      return moduleName;
    }
  }
  return null;
}

function dependencyPackageDir(dependency) {
  if (dependency.kind === "local") {
    return resolve(proofRoot, dependency.path);
  }
  if (dependency.kind === "git") {
    return join(proofRoot, ".lake", "packages", dependency.name, dependency.subDir ?? "");
  }
  return null;
}

function externalLakeConfig(packageDir, dependencyName) {
  if (!externalLakeConfigs.has(packageDir)) {
    externalLakeConfigs.set(packageDir, loadLakeConfig(packageDir, `${dependencyName} lakefile`, errors));
  }
  return externalLakeConfigs.get(packageDir);
}

function referencePathCandidates(path, dependency) {
  const normalized = normalizePath(path);
  const prefixes = [
    dependency.kind === "local" ? dependency.path : null,
    dependency.kind === "git" ? dependency.subDir : null
  ].map(normalizePath).filter(Boolean);
  const candidates = [normalized];

  for (const prefix of prefixes) {
    if (normalized === prefix) {
      candidates.push("");
    } else if (normalized.startsWith(`${prefix}/`)) {
      candidates.push(normalized.slice(prefix.length + 1));
    }
  }

  return unique(candidates).filter(Boolean);
}

function checkProofType({ theoremName, theoremModule, proofName, proofModule, proofFile }) {
  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-type-"));
  const inspector = join(tmp, "ProofTypeCheck.lean");

  try {
    writeFileSync(inspector, proofTypeInspector({ theoremModule, proofModule, theoremName, proofName }));
    const mergedLeanPath = join(tmp, "merged-lean");
    mergeCurrentSubmissionBuilds(mergedLeanPath);
    const leanPath = proofLeanPath(mergedLeanPath);
    const result = spawnSync("lean", [inspector], {
      encoding: "utf8",
      env: leanPath ? { ...process.env, LEAN_PATH: leanPath } : process.env,
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean proof type check for ${proofFile}: ${result.error.message}`);
      return;
    }
    if (result.status !== 0) {
      errors.push(`proof theorem type does not match statement for ${theoremName}\n${result.stdout}${result.stderr}`.trim());
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function proofLeanPath(mergedLeanPath) {
  const result = spawnSync("lake", ["--dir", proofRoot, "env", "printenv", "LEAN_PATH"], {
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });
  if (result.error || result.status !== 0) {
    return null;
  }

  const proofBuildPath = join(proofRoot, ".lake", "build", "lib", "lean");
  const statementBuildPath = statementRoot
    ? join(statementRoot, ".lake", "build", "lib", "lean")
    : null;
  const entries = result.stdout.trim().split(delimiter).filter(Boolean);
  const externalEntries = entries.filter((entry) => entry !== proofBuildPath && entry !== statementBuildPath);
  return unique([mergedLeanPath, ...externalEntries]).join(delimiter);
}

function mergeCurrentSubmissionBuilds(targetRoot) {
  mkdirSync(targetRoot, { recursive: true });
  if (statementRoot) {
    linkTree(join(statementRoot, ".lake", "build", "lib", "lean"), targetRoot);
  }
  linkTree(join(proofRoot, ".lake", "build", "lib", "lean"), targetRoot);
}

function linkTree(sourceRoot, targetRoot) {
  if (!existsSync(sourceRoot)) {
    return;
  }
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = join(sourceRoot, entry.name);
    const target = join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(target, { recursive: true });
      linkTree(source, target);
      continue;
    }
    if (entry.isFile() && !existsSync(target)) {
      mkdirSync(resolve(target, ".."), { recursive: true });
      symlinkSync(source, target);
    }
  }
}

function currentStatementAxiomNames() {
  return new Set(
    statements
      .filter((entry) => entry.Type === "Axiom")
      .map((entry) => entry?.Statement?.Name)
      .filter(Boolean)
  );
}

function isCurrentTheoremReference(reference) {
  return reference?.CurrentSubmission === true || reference?.SubmissionSlug === meta.submissionSlug;
}

function theoremNameForProof(proof) {
  return proof?.Theorem?.Name ?? null;
}

function proofTypeInspector({ theoremModule, proofModule, theoremName, proofName }) {
  const imports = unique([theoremModule, proofModule])
    .map((moduleName) => `import ${moduleName}`)
    .join("\n");
  return `import Lean
${imports}

open Lean Meta

#eval show MetaM Unit from do
  let statementInfo <- getConstInfo \`${theoremName}
  let proofInfo <- getConstInfo \`${proofName}
  unless <- isDefEq statementInfo.type proofInfo.type do
    throwError "proof theorem type does not match statement type"
`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

report("proof types match statements", errors, warnings);
