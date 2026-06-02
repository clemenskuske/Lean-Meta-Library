#!/usr/bin/env node
// Checks that conjecture surface entries use the expected direct child folder and namespace shape.
// Conjectures are listed in metadata as unproved proof entries with `conjecture: True`.
import { join } from "node:path";
import {
  isConjectureProofEntry,
  loadContext,
  report,
  surfaceNamespaceForEntry
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { inspectIntroducedDeclarations } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const surfaceRoot = join(packageRoot, "surface-package");
const surfaceLakeConfig = loadLakeConfig(surfaceRoot, "surface lakefile", errors);
const conjectures = (meta.surfaceEntries ?? []).filter((entry) => entry.type === "Conjecture");
const conjectureMetadata = new Map(
  (meta.proofs ?? []).filter(isConjectureProofEntry).map((proof) => [proof.theorem, proof])
);
const surfaceConjectureNames = new Set();

for (const entry of conjectures) {
  if (!/^surface-package\/[^/]+$/.test(entry.folder ?? "")) {
    errors.push(`conjecture ${entry.name} must live in a direct child folder of surface-package`);
  }
  if (!entry.name?.startsWith(`${namespaceRoot}.Surface.Conjecture.`)) {
    errors.push(`conjecture namespace is incorrect: ${entry.name}`);
  }

  const surfacePath = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const moduleName = lakeModuleForFile(surfaceLakeConfig, surfaceRoot, surfacePath);
  if (!moduleName) {
    errors.push(`could not infer conjecture surface module: ${entry.folder}/Surface.lean`);
    continue;
  }

  const importsByFile = parseLeanImports([surfacePath], errors);
  const declarations = (inspectIntroducedDeclarations({
    packageDir: surfaceRoot,
    moduleName,
    imports: ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== moduleName)],
    label: `${entry.folder}/Surface.lean`,
    errors
  }) ?? []).filter((declaration) => ["axiom", "theorem"].includes(declaration.kind));
  if (declarations.length === 0) {
    errors.push(`conjecture surface file declares no axiom or theorem: ${entry.folder}/Surface.lean`);
    continue;
  }

  const namespace = surfaceNamespaceForEntry(entry);
  for (const declaration of declarations) {
    const fullName = declaration.name;
    if (!isDirectChildOf(fullName, namespace)) {
      continue;
    }
    surfaceConjectureNames.add(fullName);
    const proof = conjectureMetadata.get(fullName);
    if (!proof) {
      errors.push(`conjecture should be listed in metadata with conjecture: True: ${fullName}`);
    } else if (proof.proofFile) {
      errors.push(`conjecture metadata entry should not include proofFile: ${fullName}`);
    }
  }
}

for (const proof of meta.proofs ?? []) {
  if (proof.theorem?.includes(".Surface.Conjecture.") && !isConjectureProofEntry(proof)) {
    errors.push(`conjecture metadata entry must set conjecture: True: ${proof.theorem}`);
  }
  if (isConjectureProofEntry(proof) && !surfaceConjectureNames.has(proof.theorem)) {
    errors.push(`conjecture metadata entry does not match a surface conjecture declaration: ${proof.theorem}`);
  }
}

function isDirectChildOf(name, namespace) {
  if (!namespace || !name.startsWith(`${namespace}.`)) {
    return false;
  }
  const suffix = name.slice(namespace.length + 1);
  return suffix.length > 0 && !suffix.includes(".");
}

report("check conjectures", errors);
