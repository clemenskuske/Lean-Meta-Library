#!/usr/bin/env node
// Scans proof files for local placeholders, then asks Lean to elaborate each proof file.
// Imported files may contain their own placeholders; this check only rejects `sorry`, `admit`, `unsafe`, or fresh axioms written in the proof files themselves.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  declarationNames,
  loadContext,
  readIfExists,
  relativePath,
  report,
  stripLeanCommentsAndStrings,
  walkFiles
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const proofFiles = new Set(
  (meta.proofs ?? [])
    .map((proof) => proof.proofFile)
    .filter(Boolean)
    .map((proofFile) => join(packageRoot, proofFile))
);

for (const file of walkFiles(join(packageRoot, "proofs")).filter((path) => path.endsWith(".lean"))) {
  proofFiles.add(file);
}

for (const file of proofFiles) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }
  const label = relativePath(packageRoot, file);
  const stripped = stripLeanCommentsAndStrings(source);
  if (/\bsorry\b/.test(stripped)) {
    errors.push(`proof file contains local sorry: ${label}`);
  }
  if (/\badmit\b/.test(stripped)) {
    errors.push(`proof file contains local admit: ${label}`);
  }
  if (/\bunsafe\b/.test(stripped)) {
    errors.push(`proof file contains local unsafe: ${label}`);
  }
  if (declarationNames(stripped, "axiom").length > 0) {
    errors.push(`proof file declares local axioms: ${label}`);
  }

  const result = spawnSync("lake", ["--dir", packageRoot, "lean", file], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.error) {
    errors.push(`could not run lake lean for ${label}: ${result.error.message}`);
    continue;
  }

  if (result.status !== 0) {
    errors.push(`Lean failed to elaborate proof file ${label}\n${result.stdout}${result.stderr}`.trim());
  }
}

report("proof axioms and sorrys", errors);
