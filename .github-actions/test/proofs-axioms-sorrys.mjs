#!/usr/bin/env node
// Scans proof files for forbidden placeholders and new axiom declarations.
// Proof files should discharge surface axioms without introducing `sorry`, `admit`, `unsafe`, or fresh axioms.
import { join } from "node:path";
import { declarationNames, loadContext, readIfExists, report, stripLeanCommentsAndStrings, walkFiles } from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const proofFiles = new Set((meta.proofs ?? []).map((proof) => join(packageRoot, proof.proofFile ?? "")));

for (const file of walkFiles(join(packageRoot, "proofs")).filter((path) => path.endsWith(".lean"))) {
  proofFiles.add(file);
}

for (const file of proofFiles) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }
  const stripped = stripLeanCommentsAndStrings(source);
  if (/\bsorry\b/.test(stripped)) {
    errors.push(`proof file contains sorry: ${file}`);
  }
  if (/\badmit\b/.test(stripped)) {
    errors.push(`proof file contains admit: ${file}`);
  }
  if (/\bunsafe\b/.test(stripped)) {
    errors.push(`proof file contains unsafe: ${file}`);
  }
  if (declarationNames(stripped, "axiom").length > 0) {
    errors.push(`proof file declares axioms: ${file}`);
  }
}

report("proof axioms and sorrys", errors);
