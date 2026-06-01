#!/usr/bin/env node
// Checks that both lakefiles and all Lean files use the namespace shape implied by metadata.
// The metadata `namespaceSlug` is the source for `ChosenSlug.Surface...` and `ChosenSlug.Proofs...`.
import { join } from "node:path";
import {
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

checkLakefile(join(packageRoot, "lakefile.lean"), "proof", `${namespaceRoot}.Proofs`);
checkLakefile(join(packageRoot, "surface-package/lakefile.lean"), "surface", `${namespaceRoot}.Surface`);

for (const entry of meta.surfaceEntries ?? []) {
  const expectedPrefix = `${namespaceRoot}.Surface.${entry.type}.`;
  if (!entry.name?.startsWith(expectedPrefix)) {
    errors.push(`surface entry namespace should start with ${expectedPrefix}: ${entry.name}`);
  }

  const source = readIfExists(join(packageRoot, entry.folder ?? "", "surface-file.lean"));
  if (!source) {
    continue;
  }
  if (!source.includes(`namespace ${entry.name}`)) {
    errors.push(`surface file ${entry.folder}/surface-file.lean missing namespace ${entry.name}`);
  }
  if (!source.includes(`end ${entry.name}`)) {
    errors.push(`surface file ${entry.folder}/surface-file.lean missing end ${entry.name}`);
  }
}

for (const proof of meta.proofs ?? []) {
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

function checkLakefile(path, label, packageName) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }
  if (!source.includes(`package ${packageName} where`)) {
    errors.push(`${label} lakefile should declare package ${packageName}`);
  }
  if (!source.includes(`lean_lib ${namespaceRoot} where`)) {
    errors.push(`${label} lakefile should declare lean_lib ${namespaceRoot}`);
  }
  if (!source.includes(`roots := #[\`${namespaceRoot}]`)) {
    errors.push(`${label} lakefile should set roots := #[\`${namespaceRoot}]`);
  }
}

report("namespaces correct", errors);
