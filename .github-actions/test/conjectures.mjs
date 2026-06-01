#!/usr/bin/env node
// Checks that conjecture surface entries use the expected direct child folder and namespace shape.
// Conjectures are listed in metadata as unproved proof entries with `conjecture: True`.
import { join } from "node:path";
import {
  declarationNames,
  isConjectureProofEntry,
  loadContext,
  readIfExists,
  report,
  surfaceNamespaceForEntry
} from "./common.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
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

  const source = readIfExists(join(packageRoot, entry.folder ?? "", "Surface.lean"));
  if (!source) {
    continue;
  }
  const axioms = declarationNames(source, "axiom");
  const theorems = declarationNames(source, "theorem");
  const declarations = [...axioms, ...theorems];
  if (declarations.length === 0) {
    errors.push(`conjecture surface file declares no axiom or theorem: ${entry.folder}/Surface.lean`);
    continue;
  }

  const namespace = surfaceNamespaceForEntry(entry);
  for (const declaration of declarations) {
    const fullName = `${namespace}.${declaration}`;
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

report("check conjectures", errors);
