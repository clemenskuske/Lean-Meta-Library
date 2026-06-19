#!/usr/bin/env node
// Checks that each proof manifest entry's proof declaration has the same compiled
// type as the statement axiom it discharges. Declarations are resolved by their
// global names against the built statement and proof packages.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { loadContext } from "../general/manifest-context.mjs";
import {
  isLeanName,
  maxBuildOutputBytes,
  proofPackageRoot,
  report,
  statementPackageRoot
} from "../common.mjs";
import { builtModuleNames, lakeDependencies, loadLakeConfig } from "../lake-config.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";
import { augmentProofLakefile } from "./augment-proof-lakefile.mjs";

const { packageRoot, manifest, namespaceRoot } = loadContext();
const errors = [];
const warnings = [];
const proofs = Array.isArray(manifest.proofs) ? manifest.proofs : [];
const stmtPkgRoot = statementPackageRoot(manifest);
const pPkgRoot = proofPackageRoot(manifest);
const proofRoot = pPkgRoot ? resolve(packageRoot, pPkgRoot) : null;
const statementRoot = stmtPkgRoot ? resolve(packageRoot, stmtPkgRoot) : null;

ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: stmtPkgRoot ? join(stmtPkgRoot, "lakefile.lean") : null,
  kind: "statement",
  label: "statement package",
  errors,
  warnings
});
augmentProofLakefile({ packageRoot, manifest, errors, warnings });
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: pPkgRoot ? join(pPkgRoot, "lakefile.lean") : null,
  kind: "proof",
  label: "proof package",
  errors,
  warnings
});

const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;
const proofDependencies = proofLakeConfig ? lakeDependencies(proofLakeConfig) : [];

const checks = collectChecks();
if (checks.length > 0) {
  runTypeChecks(checks);
}

report("proof types match statements", errors, warnings);

function collectChecks() {
  const entries = [];

  for (const proof of proofs) {
    const axiom = proof?.axiom;
    const proofName = proof?.proof;

    if (!isLeanName(axiom)) {
      errors.push(`proof manifest entry is missing a valid axiom name: ${axiom ?? "(missing)"}`);
      continue;
    }
    if (!isLeanName(proofName)) {
      errors.push(`proof manifest entry for ${axiom} is missing a valid proof name: ${proofName ?? "(missing)"}`);
      continue;
    }
    entries.push({ axiom, proof: proofName });
  }

  return entries;
}

function runTypeChecks(entries) {
  if (!proofRoot) {
    errors.push("proof package is required to type-check proof manifest entries");
    return;
  }

  const modules = inspectorModules(entries);
  if (modules.length === 0) {
    errors.push("no built proof modules were found to type-check proof manifest entries");
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-type-"));
  const inspector = join(tmp, "ProofTypeCheck.lean");

  try {
    writeFileSync(inspector, proofTypeInspector({ modules, entries }));
    const mergedLeanPath = join(tmp, "merged-lean");
    mergeCurrentSubmissionBuilds(mergedLeanPath);
    const leanPath = inspectorLeanPath(mergedLeanPath);
    const result = spawnSync("lean", [inspector], {
      encoding: "utf8",
      env: leanPath ? { ...process.env, LEAN_PATH: leanPath } : process.env,
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean proof type check: ${result.error.message}`);
      return;
    }
    if (result.status !== 0) {
      errors.push(`proof theorem type does not match statement\n${result.stdout}${result.stderr}`.trim());
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function inspectorModules(entries) {
  const modules = new Set(builtModuleNames(proofRoot));

  let needsLocalStatements = false;
  for (const entry of entries) {
    if (isLocalAxiom(entry.axiom)) {
      needsLocalStatements = true;
      continue;
    }
    for (const moduleName of externalStatementModules(entry.axiom)) {
      modules.add(moduleName);
    }
  }

  if (needsLocalStatements && statementRoot) {
    for (const moduleName of builtModuleNames(statementRoot)) {
      modules.add(moduleName);
    }
  }

  return [...modules].filter(isLeanName).sort();
}

function isLocalAxiom(axiom) {
  return Boolean(namespaceRoot) && (axiom === namespaceRoot || axiom.startsWith(`${namespaceRoot}.`));
}

function externalStatementModules(axiom) {
  const dependencyName = `${axiom.split(".")[0]}.Statements`;
  const dependency = proofDependencies.find((item) => item.name === dependencyName);
  if (!dependency) {
    errors.push(`proof lakefile must declare statement dependency ${dependencyName} for axiom ${axiom}`);
    return [];
  }

  const packageDir = dependencyPackageDir(dependency);
  if (!packageDir || !existsSync(packageDir)) {
    errors.push(`could not find checked-out package for proof dependency ${dependencyName}`);
    return [];
  }

  return builtModuleNames(packageDir);
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

function inspectorLeanPath(mergedLeanPath) {
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

function proofTypeInspector({ modules, entries }) {
  const imports = modules.map((moduleName) => `import ${moduleName}`).join("\n");
  const checks = entries
    .map((entry) => `#eval show MetaM Unit from do
  let statementInfo <- getConstInfo \`${entry.axiom}
  let proofInfo <- getConstInfo \`${entry.proof}
  unless <- isDefEq statementInfo.type proofInfo.type do
    throwError "proof theorem type does not match statement type for ${entry.axiom}"`)
    .join("\n\n");
  return `import Lean
${imports}

open Lean Meta

${checks}
`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
