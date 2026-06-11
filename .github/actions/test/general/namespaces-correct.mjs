#!/usr/bin/env node
// Checks that submitted package and metadata names use the namespace implied by submissionSlug.
import { loadContext } from "./meta-context.mjs";
import {
  isLeanName,
  metadataPackageSlug,
  packageRootForLakefile,
  proofLakefilePath,
  report,
  requireMeta,
  statementLakefilePath
} from "../common.mjs";
import { hasLeanLib, lakeDependencies, loadLakeConfig } from "../lake-config.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];
const statementRoot = statementLakefilePath(meta)
  ? packageRootForLakefile(packageRoot, statementLakefilePath(meta))
  : null;
const proofRoot = proofLakefilePath(meta)
  ? packageRootForLakefile(packageRoot, proofLakefilePath(meta))
  : null;

const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement lakefile", errors) : null;
const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;

requireMeta(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from metadata");
}

if (!metadataPackageSlug(meta)) {
  errors.push("metadata must define submissionSlug for namespace checks");
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
  for (const entry of meta.statements ?? []) {
    const statementName = entry.Statement?.Name;
    if (!statementName) {
      continue;
    }
    if (!isLeanName(statementName)) {
      errors.push(`statement metadata entry is missing a valid Statement.Name: ${statementName}`);
      continue;
    }
    if (namespaceRoot && !statementName.startsWith(`${namespaceRoot}.`)) {
      errors.push(`statement Lean name should start with ${namespaceRoot}.: ${statementName}`);
    }
  }
}

function checkProofMetadataNames() {
  for (const proof of meta.proofs ?? []) {
    const theorem = proof.Theorem ?? {};
    const proofName = proof.Proof?.Name;
    if (!isLeanName(proofName)) {
      errors.push(`proof metadata entry is missing a valid Proof.Name: ${proofName ?? "(missing)"}`);
      continue;
    }
    if (namespaceRoot && !proofName.startsWith(`${namespaceRoot}.`)) {
      errors.push(`proof Lean name should start with ${namespaceRoot}.: ${proofName}`);
    }

    if (theorem.CurrentSubmission === true && namespaceRoot && !theorem.Name?.startsWith(`${namespaceRoot}.`)) {
      errors.push(`proof Theorem.Name for current submission should start with ${namespaceRoot}.: ${theorem.Name ?? "(missing)"}`);
    }
  }
}

report("namespaces correct", errors);
