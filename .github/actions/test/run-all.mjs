#!/usr/bin/env node
// Runs the full first-run submission checker suite.
// It prepares the Lake build/cache first, then runs independent static and Lean checks in parallel groups.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { createOutputConfig } from "../create-submission/create-output-config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { runnerOptions, manifestPath, checkerArgs } = parseRunnerArgs(process.argv.slice(2));
const checkRunId = process.env.LML_CHECK_RUN_ID || `run-all:${randomUUID()}`;
const prepareChecks = runnerOptions.skipBuildCache ? [] : [
  "statements/prepare-build-cache.mjs",
  "proofs/prepare-build-cache.mjs"
];
const staticChecks = [
  "general/files-present.mjs",
  "statements/no-extra-files.mjs",
  "general/manifest-check.mjs",
  "general/base-import-versions.mjs",
  "general/namespaces-correct.mjs",
  "general/folder-size.mjs",
  "general/filetypes.mjs",
  "general/commit-is-hash.mjs",
  "general/slug-unique.mjs",
  "statements/file-context.mjs",
  "statements/imports.mjs"
];
const leanChecks = [
  "proofs/no-forbidden-axioms.mjs",
  "proofs/type-matches-statements.mjs",
  "statements/introduced-declarations.mjs"
];

const submissionKey = `${resolveSubmissionKey(manifestPath)}.${sanitizeForFilename(checkRunId)}`;
const outputConfigPath = createOutputConfig(manifestPath, submissionKey);
const outputCheckerArgs = substituteManifest(checkerArgs, outputConfigPath);

let failed = false;

for (const group of [
  { name: "prepare build/cache", checks: prepareChecks, parallel: false },
  { name: "static checks", checks: staticChecks, parallel: true },
  { name: "Lean checks", checks: leanChecks, parallel: false }
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
  console.log(`\nSubmission config kept at: ${outputConfigPath}`);
  process.exit(1);
}

rmSync(outputConfigPath, { force: true });
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
    const child = spawn(process.execPath, [join(here, check), ...outputCheckerArgs], {
      encoding: "utf8",
      env: { ...process.env, LML_CHECK_RUN_ID: checkRunId }
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

function sanitizeForFilename(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "-");
}

function resolveSubmissionKey(manifestFilePath) {
  if (!existsSync(manifestFilePath)) {
    return "submission";
  }
  try {
    const manifest = YAML.parse(readFileSync(manifestFilePath, "utf8") || "") ?? {};
    // Raw YAML: SubmissionSlug (new format) or submissionSlug (old format) or packageSlug (legacy).
    const slug = manifest.SubmissionSlug ?? manifest.submissionSlug ?? manifest.packageSlug;
    if (slug && typeof slug === "string" && slug.trim()) {
      return slug.trim();
    }
  } catch {
    // fall through to basename
  }
  return manifestFilePath.replace(/\.ya?ml$/i, "").split(/[\\/]/).pop() ?? "submission";
}

function substituteManifest(args, newManifestPath) {
  const result = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--manifest" && i + 1 < args.length) {
      result.push("--manifest", newManifestPath);
      i++;
    } else if (arg.startsWith("--manifest=")) {
      result.push(`--manifest=${newManifestPath}`);
    } else {
      result.push(arg);
    }
  }
  if (!result.some((a) => a === "--manifest" || a.startsWith("--manifest="))) {
    result.push(`--manifest=${newManifestPath}`);
  }
  return result;
}

function parseRunnerArgs(args) {
  const runnerOptions = { skipBuildCache: false };
  const checkerArgs = [];
  const positional = [];
  let manifestPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--skip-build-cache") {
      runnerOptions.skipBuildCache = true;
      continue;
    }
    if (arg === "--manifest" && i + 1 < args.length) {
      manifestPath = args[i + 1];
      checkerArgs.push(arg, args[i + 1]);
      i++;
      continue;
    }
    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
      checkerArgs.push(arg);
      continue;
    }
    if (arg.startsWith("-")) {
      checkerArgs.push(arg);
      continue;
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (manifestPath && positional.length > 0)) {
    throw new Error("Use one manifest file argument, for example: --manifest=path/to/manifest.yaml.");
  }

  const selectedManifestPath = manifestPath ?? positional[0] ?? "manifest.yaml";
  return { runnerOptions, manifestPath: selectedManifestPath, checkerArgs };
}
