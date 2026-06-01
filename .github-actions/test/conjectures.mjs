#!/usr/bin/env node
// Checks that conjecture surface entries use the expected direct child folder and namespace shape.
// This first pass also keeps conjectures out of the proof-target list.
import { join } from "node:path";
import { declarationNames, loadContext, readIfExists, report } from "./common.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const conjectures = (meta.surfaceEntries ?? []).filter((entry) => entry.type === "Conjecture");

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
  if (axioms.length + theorems.length === 0) {
    errors.push(`conjecture surface file declares no axiom or theorem: ${entry.folder}/Surface.lean`);
  }
}

for (const proof of meta.proofs ?? []) {
  if (proof.theorem?.includes(".Surface.Conjecture.")) {
    errors.push(`conjecture should not be listed as a proof target yet: ${proof.theorem}`);
  }
}

report("check conjectures", errors);
