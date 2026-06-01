#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { loadContext, proofConstantForTheorem, report, requireMeta } from "./common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
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

  for (const file of ["latex-file.tex", "surface-file.lean"]) {
    if (!existsSync(join(folder, file))) {
      errors.push(`surface entry ${entry.name ?? basename(entry.folder)} missing ${file}`);
    }
  }
}

for (const proof of meta.proofs ?? []) {
  if (!proof.proofFile) {
    errors.push(`proof for ${proof.theorem ?? "(unknown theorem)"} has no proofFile`);
    continue;
  }
  if (!existsSync(join(packageRoot, proof.proofFile))) {
    errors.push(`proof file missing for ${proof.theorem ?? proofConstantForTheorem(proof.theorem)}: ${proof.proofFile}`);
  }
}

report("files present", errors);
