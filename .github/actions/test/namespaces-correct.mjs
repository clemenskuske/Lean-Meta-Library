#!/usr/bin/env node
// Checks that package names and Lean declarations use the namespace shape implied by packageSlug.
import { join } from "node:path";
import {
  isLeanName,
  loadContext,
  metadataPackageSlug,
  metadataProofs,
  metadataStatements,
  packageRootForLakefile,
  proofFileForProofEntry,
  proofLakefilePath,
  proofNameForProofEntry,
  report,
  requireMeta,
  statementLakefilePath,
  statementLeanFileForEntry
} from "./common.mjs";
import { hasLeanLib, lakeDependencies, lakeModuleForFile, loadLakeConfig, normalizePath } from "./lake-config.mjs";
import { inspectIntroducedDeclarations } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];
const statementRoot = statementLakefilePath(meta) ? packageRootForLakefile(packageRoot, statementLakefilePath(meta)) : null;
const proofRoot = proofLakefilePath(meta) ? packageRootForLakefile(packageRoot, proofLakefilePath(meta)) : null;
const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement/declaration lakefile", errors) : null;
const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;

requireMeta(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from metadata");
}

if (!metadataPackageSlug(meta)) {
  errors.push("metadata must define packageSlug for namespace checks");
}

checkStatementLakefile(statementLakeConfig);
checkProofLakefile(proofLakeConfig);

if (errors.length === 0) {
  checkStatementDeclarations();
  checkProofDeclarations();
}

function checkStatementDeclarations() {
  for (const entry of metadataStatements(meta)) {
    if (!entry.name) {
      continue;
    }
    if (namespaceRoot && !entry.name.startsWith(`${namespaceRoot}.`)) {
      errors.push(`statement/declaration Lean name should start with ${namespaceRoot}.: ${entry.name}`);
    }
    if (entry.name.includes(".Surface.")) {
      errors.push(`statement/declaration Lean name should not include old .Surface. package marker: ${entry.name}`);
    }

    const statementFile = statementLeanFileForEntry(entry);
    const moduleName = statementFile ? lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, statementFile)) : null;
    if (!moduleName) {
      errors.push(`could not infer statement/declaration module for ${statementFile ?? "(missing statement file)"}`);
      continue;
    }

    const importsByFile = parseLeanImports([join(packageRoot, statementFile)], errors);
    const declarations = inspectIntroducedDeclarations({
      packageDir: statementRoot,
      moduleName,
      imports: ["Init", ...(importsByFile.get(join(packageRoot, statementFile)) ?? []).filter((imported) => imported !== moduleName)],
      label: statementFile,
      errors
    }) ?? [];
    if (!declarations.some((declaration) => isDirectChildOf(declaration.name, namespaceOfDeclaration(entry.name)))) {
      errors.push(`statement/declaration file ${statementFile} does not declare a direct child of ${namespaceOfDeclaration(entry.name)}`);
    }
  }
}

function checkProofDeclarations() {
  for (const proof of metadataProofs(meta)) {
    const proofFile = proofFileForProofEntry(proof);
    if (!proofFile) {
      continue;
    }
    const proofName = proofNameForProofEntry(proof);
    if (!isLeanName(proofName)) {
      errors.push(`proof metadata entry is missing a valid Proof.Name: ${proofName ?? "(missing)"}`);
      continue;
    }
    if (namespaceRoot && !proofName.startsWith(`${namespaceRoot}.`)) {
      errors.push(`proof Lean name should start with ${namespaceRoot}.: ${proofName}`);
    }

    const moduleName = lakeModuleForFile(proofLakeConfig, proofRoot, join(packageRoot, proofFile));
    if (!moduleName) {
      errors.push(`could not infer proof module for ${proofFile}`);
      continue;
    }

    const declarations = inspectIntroducedDeclarations({
      packageDir: proofRoot,
      moduleName,
      imports: ["Init"],
      label: proofFile,
      errors
    }) ?? [];
    if (!declarations.some((declaration) => declaration.name === proofName && declaration.kind === "theorem")) {
      errors.push(`proof file ${proofFile} missing theorem ${proofName}`);
    }
  }
}

function checkProofLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Proofs`) {
    errors.push(`proof lakefile should declare package ${namespaceRoot}.Proofs`);
  }
  for (const dependency of lakeDependencies(config).filter((item) => item.kind === "local")) {
    const isAllowedLegacySurface = dependency.name === `${namespaceRoot}.Surface` && normalizePath(dependency.path) === "surface-package";
    const isAllowedStatementPackage = dependency.name === `${namespaceRoot}.Statements`;
    if (!isAllowedLegacySurface && !isAllowedStatementPackage) {
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
    errors.push(`statement/declaration lakefile should declare package ${namespaceRoot}.Statements`);
  }
  if (!hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Statements`)) {
    errors.push(`statement/declaration lakefile should declare shared lean_lib ${namespaceRoot}.Statements`);
  }
}

function isDirectChildOf(name, namespace) {
  if (!namespace || !name.startsWith(`${namespace}.`)) {
    return false;
  }
  const suffix = name.slice(namespace.length + 1);
  return suffix.length > 0 && !suffix.includes(".");
}

function namespaceOfDeclaration(name) {
  const value = String(name ?? "");
  const index = value.lastIndexOf(".");
  return index === -1 ? value : value.slice(0, index);
}

report("namespaces correct", errors);
