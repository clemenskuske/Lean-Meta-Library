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

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];

requireMeta(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from metadata");
}

if (!meta.namespaceSlug) {
  errors.push("metadata must define namespaceSlug for namespace checks");
}

checkProofLakefile(join(packageRoot, "lakefile.lean"));
checkSurfaceLakefile(join(packageRoot, "surface-package/lakefile.lean"));

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

function checkProofLakefile(path) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }
  if (!source.includes(`package ${namespaceRoot}.Proofs where`)) {
    errors.push(`proof lakefile should declare package ${namespaceRoot}.Proofs`);
  }
  if (!source.includes(`require ${namespaceRoot}.Surface from "./surface-package"`)) {
    errors.push(`proof lakefile should require local package ${namespaceRoot}.Surface from ./surface-package`);
  }
  if (!source.includes(`lean_lib ${namespaceRoot}.Proofs where`)) {
    errors.push(`proof lakefile should declare lean_lib ${namespaceRoot}.Proofs`);
  }
  if (!source.includes(`srcDir := "proofs"`)) {
    errors.push(`proof lakefile should set srcDir := "proofs"`);
  }
}

function checkSurfaceLakefile(path) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }
  if (!source.includes(`package ${namespaceRoot}.Surface where`)) {
    errors.push(`surface lakefile should declare package ${namespaceRoot}.Surface`);
  }
  for (const entry of meta.surfaceEntries ?? []) {
    const moduleRoot = entry.folder?.split("/")?.at(-1);
    if (moduleRoot && !source.includes(`lean_lib ${moduleRoot} where`)) {
      errors.push(`surface lakefile should declare lean_lib ${moduleRoot}`);
    }
    if (moduleRoot && !source.includes(`globs := #[\`${moduleRoot}.+]`)) {
      errors.push(`surface lakefile should set globs := #[\`${moduleRoot}.+]`);
    }
  }
}

report("namespaces correct", errors);
