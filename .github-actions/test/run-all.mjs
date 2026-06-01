#!/usr/bin/env node
// Runs the full first-run submission checker suite in a fixed order.
// It keeps going after individual failures so one run can show all currently failing checks.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const checks = [
  "files-present.mjs",
  "metadata-check.mjs",
  "namespaces-correct.mjs",
  "build-packages.mjs",
  "proofs-axioms-sorrys.mjs",
  "conjectures.mjs",
  "axioms-to-proofs.mjs",
  "folder-size.mjs",
  "filetypes.mjs",
  "surface-file-context.mjs",
  "dependency-check.mjs"
];

let failed = false;

for (const check of checks) {
  console.log(`\n== ${check} ==`);
  const result = spawnSync(process.execPath, [join(here, check), ...process.argv.slice(2)], {
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nAll first-run submission checks passed.");
