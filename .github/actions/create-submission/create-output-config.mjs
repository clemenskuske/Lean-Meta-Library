#!/usr/bin/env node
// Step 1 of the submission pipeline: copies manifest.yaml to
// output.config.<key>.yaml in the same directory.
//
// Later pipeline steps will augment this file with repo information and run the
// full build suite against it. Keeping the file around on failure lets you
// inspect exactly what input was handed to the checker.
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Creates output.config.<key>.yaml next to manifestPath by copying it.
 * Returns the path of the created file.
 */
export function createOutputConfig(manifestPath, key) {
  const outputPath = join(dirname(manifestPath), `output.config.${key}.yaml`);
  copyFileSync(manifestPath, outputPath);
  return outputPath;
}

// Standalone: node create-output-config.mjs --manifest=<path> --key=<key>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let manifestPath = null;
  let key = null;

  for (const arg of args) {
    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
    } else if (arg.startsWith("--key=")) {
      key = arg.slice("--key=".length);
    }
  }

  if (!manifestPath || !key) {
    console.error("Usage: create-output-config.mjs --manifest=<path> --key=<key>");
    process.exit(1);
  }

  const output = createOutputConfig(manifestPath, key);
  console.log(`Created: ${output}`);
}
