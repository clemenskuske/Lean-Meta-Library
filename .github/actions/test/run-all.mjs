#!/usr/bin/env node
// Runs the full first-run submission checker suite.
// It prepares the Lake build/cache first, then runs independent static and Lean checks in parallel groups.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { runnerOptions, checkerArgs } = parseRunnerArgs(process.argv.slice(2));
const prepareChecks = runnerOptions.skipBuildCache ? [] : ["prepare-build-cache.mjs"];
const staticChecks = [
  "files-present.mjs",
  "metadata-check.mjs",
  "mathlib-version.mjs",
  "namespaces-correct.mjs",
  "folder-size.mjs",
  "filetypes.mjs",
  "surface-file-context.mjs",
  "dependency-check.mjs"
];
const leanChecks = [
  "proofs-axioms-sorrys.mjs",
  "declarations-to-proofs.mjs",
  "surface-declarations.mjs"
];

let failed = false;

for (const group of [
  { name: "prepare build/cache", checks: prepareChecks, parallel: false },
  { name: "static checks", checks: staticChecks, parallel: true },
  { name: "Lean checks", checks: leanChecks, parallel: true }
]) {
  if (group.checks.length === 0) {
    continue;
  }

  console.log(`\n## ${group.name} ##`);
  const results = group.parallel
    ? await Promise.all(group.checks.map(runCheck))
    : await runSerial(group.checks);

  for (const result of results) {
    printResult(result);
    if (result.status !== 0) {
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nAll first-run submission checks passed.");

async function runSerial(checks) {
  const results = [];
  for (const check of checks) {
    results.push(await runCheck(check));
  }
  return results;
}

function runCheck(check) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, check), ...checkerArgs], {
      encoding: "utf8"
    });
    const chunks = [];

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => {
      chunks.push(`could not start ${check}: ${error.message}\n`);
      resolve({ check, status: 1, output: Buffer.concat(chunks.map(toBuffer)).toString("utf8") });
    });
    child.on("close", (status) => {
      resolve({ check, status: status ?? 1, output: Buffer.concat(chunks.map(toBuffer)).toString("utf8") });
    });
  });
}

function printResult({ check, output }) {
  console.log(`\n== ${check} ==`);
  if (output) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  }
}

function toBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(String(value));
}

function parseRunnerArgs(args) {
  const runnerOptions = { skipBuildCache: false };
  const checkerArgs = [];

  for (const arg of args) {
    if (arg === "--skip-build-cache") {
      runnerOptions.skipBuildCache = true;
      continue;
    }
    checkerArgs.push(arg);
  }

  return { runnerOptions, checkerArgs };
}
