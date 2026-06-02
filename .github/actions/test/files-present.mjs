#!/usr/bin/env node
// Verifies that the required submission package files and folders exist.
// It follows the metadata entries to check every surface file, LaTeX file, and proof file.
import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { isConjectureProofEntry, loadContext, proofConstantForTheorem, report, requireMeta } from "./common.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];

requireMeta(context, errors);

for (const path of [
  "lakefile.lean",
  "abstract.tex",
  "surface-package",
  "surface-package/lakefile.lean",
  "proofs"
]) {
  const absolute = join(packageRoot, path);
  if (!existsSync(absolute)) {
    errors.push(`missing ${path}`);
  }
}

for (const entry of meta.surfaceEntries ?? []) {
  if (!entry.folder) {
    errors.push(`surface entry ${entry.name ?? "(unnamed)"} has no folder`);
    continue;
  }

  const folder = join(packageRoot, entry.folder);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    errors.push(`surface entry folder missing: ${entry.folder}`);
    continue;
  }

  for (const file of ["latex-file.tex", "Surface.lean"]) {
    if (!existsSync(join(folder, file))) {
      errors.push(`surface entry ${entry.name ?? basename(entry.folder)} missing ${file}`);
    }
  }
}

if (namespaceRoot && existsSync(join(packageRoot, "surface-package", namespaceRoot))) {
  errors.push(`surface package should not contain slug-named aggregate folder: surface-package/${namespaceRoot}`);
}

for (const proof of meta.proofs ?? []) {
  if (isConjectureProofEntry(proof)) {
    continue;
  }
  if (!proof.proofFile) {
    errors.push(`proof for ${proof.theorem ?? "(unknown theorem)"} has no proofFile`);
    continue;
  }
  if (!existsSync(join(packageRoot, proof.proofFile))) {
    errors.push(`proof file missing for ${proof.theorem ?? proofConstantForTheorem(proof.theorem)}: ${proof.proofFile}`);
  }
}

report("files present", errors);
