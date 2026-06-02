#!/usr/bin/env node
// Checks that both lakefiles and all Lean files use the namespace shape implied by metadata.
// The metadata `namespaceSlug` is the source for `ChosenSlug.Surface...` and `ChosenSlug.Proofs...`.
import { join } from "node:path";
import {
  isConjectureProofEntry,
  loadContext,
  proofConstantForTheorem,
  proofNamespaceForTheorem,
  readIfExists,
  report,
  requireMeta
} from "./common.mjs";
import { hasLeanLib, lakeDependencies, loadLakeConfig, normalizePath } from "./lake-config.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];
const proofLakeConfig = loadLakeConfig(packageRoot, "proof lakefile", errors);
const surfaceLakeConfig = loadLakeConfig(join(packageRoot, "surface-package"), "surface lakefile", errors);

requireMeta(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from metadata");
}

if (!meta.namespaceSlug) {
  errors.push("metadata must define namespaceSlug for namespace checks");
}

checkProofLakefile(proofLakeConfig);
checkSurfaceLakefile(surfaceLakeConfig);

for (const entry of meta.surfaceEntries ?? []) {
  const expectedPrefix = `${namespaceRoot}.Surface.${entry.type}.`;
  if (!entry.name?.startsWith(expectedPrefix)) {
    errors.push(`surface entry namespace should start with ${expectedPrefix}: ${entry.name}`);
  }

  const source = readIfExists(join(packageRoot, entry.folder ?? "", "Surface.lean"));
  if (!source) {
    continue;
  }
  if (!source.includes(`namespace ${entry.name}`)) {
    errors.push(`surface file ${entry.folder}/Surface.lean missing namespace ${entry.name}`);
  }
  if (!source.includes(`end ${entry.name}`)) {
    errors.push(`surface file ${entry.folder}/Surface.lean missing end ${entry.name}`);
  }
}

for (const proof of meta.proofs ?? []) {
  if (isConjectureProofEntry(proof)) {
    continue;
  }
  if (!proof.proofFile) {
    continue;
  }
  const expectedNamespace = proofNamespaceForTheorem(proof.theorem ?? "");
  const expectedConstant = proofConstantForTheorem(proof.theorem ?? "");
  const source = readIfExists(join(packageRoot, proof.proofFile ?? ""));
  if (!expectedNamespace) {
    errors.push(`proof theorem is not in a Surface.Theorem namespace: ${proof.theorem}`);
    continue;
  }
  if (!source) {
    continue;
  }
  if (!source.includes(`namespace ${expectedNamespace}`)) {
    errors.push(`proof file ${proof.proofFile} missing namespace ${expectedNamespace}`);
  }
  if (!source.includes(`end ${expectedNamespace}`)) {
    errors.push(`proof file ${proof.proofFile} missing end ${expectedNamespace}`);
  }
  if (!new RegExp(`\\btheorem\\s+${expectedConstant}\\b`).test(source)) {
    errors.push(`proof file ${proof.proofFile} missing theorem ${expectedConstant}`);
  }
}

function checkProofLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Proofs`) {
    errors.push(`proof lakefile should declare package ${namespaceRoot}.Proofs`);
  }
  const localSurfaceDependency = lakeDependencies(config).find(
    (dependency) => dependency.kind === "local" && dependency.name === `${namespaceRoot}.Surface`
  );
  if (!localSurfaceDependency || normalizePath(localSurfaceDependency.path) !== "surface-package") {
    errors.push(`proof lakefile should require local package ${namespaceRoot}.Surface from ./surface-package`);
  }
  const hasProofLib = hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Proofs`);
  if (!hasProofLib) {
    errors.push(`proof lakefile should declare lean_lib ${namespaceRoot}.Proofs`);
  } else if (!hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Proofs` && normalizePath(lib.srcDir) === "proofs")) {
    errors.push(`proof lakefile should set srcDir := "proofs"`);
  }
}

function checkSurfaceLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Surface`) {
    errors.push(`surface lakefile should declare package ${namespaceRoot}.Surface`);
  }
  for (const entry of meta.surfaceEntries ?? []) {
    const moduleRoot = entry.folder?.split("/")?.at(-1);
    const surfaceLib = (config.leanLibs ?? []).find((lib) => lib.name === moduleRoot);
    if (moduleRoot && !surfaceLib) {
      errors.push(`surface lakefile should declare lean_lib ${moduleRoot}`);
      continue;
    }
    if (moduleRoot && !(surfaceLib.globs ?? []).includes(`${moduleRoot}.+`)) {
      errors.push(`surface lakefile should set globs := #[\`${moduleRoot}.+]`);
    }
  }
}

report("namespaces correct", errors);
