#!/usr/bin/env node
// Checks that submitted package and manifest names use the namespace implied by submissionSlug.
import { resolve } from "node:path";
import { loadContext } from "./manifest-context.mjs";
import {
  isLeanName,
  manifestPackageSlug,
  proofPackageRoot,
  report,
  requireManifest,
  statementPackageRoot
} from "../common.mjs";
import { hasLeanLib, lakeDependencies, loadLakeConfig } from "../lake-config.mjs";

const context = loadContext();
const { packageRoot, manifest, namespaceRoot } = context;
const errors = [];
const stmtRootFolder = statementPackageRoot(manifest);
const pRootFolder = proofPackageRoot(manifest);
const statementRoot = stmtRootFolder ? resolve(packageRoot, stmtRootFolder) : null;
const proofRoot = pRootFolder ? resolve(packageRoot, pRootFolder) : null;

const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement lakefile", errors) : null;
const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;

requireManifest(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from manifest");
}

if (!manifestPackageSlug(manifest)) {
  errors.push("manifest must define submissionSlug for namespace checks");
}

checkStatementLakefile(statementLakeConfig);
checkProofLakefile(proofLakeConfig);
checkStatementMetadataNames();
checkProofMetadataNames();

function checkProofLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Proofs`) {
    errors.push(`proof lakefile should declare package ${namespaceRoot}.Proofs`);
  }
  for (const dependency of lakeDependencies(config).filter((item) => item.kind === "local")) {
    if (dependency.name !== `${namespaceRoot}.Statements`) {
      errors.push(`proof lakefile has unexpected local dependency ${dependency.name} from ${dependency.path}`);
    }
  }
  if (!hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Proofs`)) {
    errors.push(`proof lakefile should declare lean_lib ${namespaceRoot}.Proofs`);
  }
}

function checkStatementLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Statements`) {
    errors.push(`statement lakefile should declare package ${namespaceRoot}.Statements`);
  }
  if (!hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Statements`)) {
    errors.push(`statement lakefile should declare lean_lib ${namespaceRoot}.Statements`);
  }
}

function checkStatementMetadataNames() {
  for (const entry of manifest.statements ?? []) {
    const statementName = entry.Statement?.Name;
    if (!statementName) {
      continue;
    }
    if (!isLeanName(statementName)) {
      errors.push(`statement manifest entry is missing a valid Statement.Name: ${statementName}`);
      continue;
    }
    if (namespaceRoot && !statementName.startsWith(`${namespaceRoot}.`)) {
      errors.push(`statement Lean name should start with ${namespaceRoot}.: ${statementName}`);
    }
  }
}

function checkProofMetadataNames() {
  for (const proof of manifest.proofs ?? []) {
    const proofName = proof.proof;
    if (!isLeanName(proofName)) {
      errors.push(`proof manifest entry is missing a valid proof name: ${proofName ?? "(missing)"}`);
      continue;
    }
    if (namespaceRoot && !proofName.startsWith(`${namespaceRoot}.`)) {
      errors.push(`proof Lean name should start with ${namespaceRoot}.: ${proofName}`);
    }
  }
}

report("namespaces correct", errors);
