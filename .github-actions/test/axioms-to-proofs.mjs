#!/usr/bin/env node
// Checks that every theorem surface axiom has a matching proof metadata entry.
// It also verifies that the proof imports and references the surface axiom it is meant to discharge.
import { join } from "node:path";
import {
  declarationNames,
  loadContext,
  proofConstantForTheorem,
  readIfExists,
  report,
  surfaceNamespaceForEntry
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const proofByTheorem = new Map((meta.proofs ?? []).map((proof) => [proof.theorem, proof]));

for (const entry of (meta.surfaceEntries ?? []).filter((item) => item.type === "Theorem")) {
  const source = readIfExists(join(packageRoot, entry.folder ?? "", "surface-file.lean"));
  if (!source) {
    continue;
  }

  const namespace = surfaceNamespaceForEntry(entry);
  const axioms = declarationNames(source, "axiom");
  for (const axiomName of axioms) {
    const fullName = `${namespace}.${axiomName}`;
    const proof = proofByTheorem.get(fullName);
    if (!proof) {
      errors.push(`surface axiom has no matching proof metadata entry: ${fullName}`);
      continue;
    }

    const proofSource = readIfExists(join(packageRoot, proof.proofFile ?? ""));
    if (!proofSource) {
      continue;
    }
    if (!proofSource.includes(`import ${namespace}`)) {
      errors.push(`proof file ${proof.proofFile} should import ${namespace}`);
    }
    if (!proofSource.includes(fullName)) {
      errors.push(`proof file ${proof.proofFile} should reference surface axiom ${fullName}`);
    }
    if (!new RegExp(`\\btheorem\\s+${proofConstantForTheorem(fullName)}\\b`).test(proofSource)) {
      errors.push(`proof file ${proof.proofFile} should prove theorem ${proofConstantForTheorem(fullName)}`);
    }
  }
}

report("connect axioms to proofs", errors);
