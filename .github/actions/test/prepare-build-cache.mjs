#!/usr/bin/env node
// Prepares the submitted Lean packages before the checker suite fans out.
// Cache fetch is best-effort, but Lake update and package builds must pass.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContext, maxBuildOutputBytes, report } from "./common.mjs";

const { packageRoot } = loadContext();
const errors = [];
const warnings = [];
const packages = [
  { label: "surface package", cwd: join(packageRoot, "surface-package") },
  { label: "proof package", cwd: packageRoot }
];

if (spawnSync("lake", ["--version"], { encoding: "utf8" }).error) {
  errors.push("lake executable not found on PATH");
} else {
  for (const item of packages) {
    if (!existsSync(item.cwd) || !statSync(item.cwd).isDirectory()) {
      errors.push(`${item.label} directory not found: ${item.cwd}`);
      continue;
    }
    if (!existsSync(join(item.cwd, "lakefile.lean"))) {
      errors.push(`${item.label} lakefile not found: ${join(item.cwd, "lakefile.lean")}`);
      continue;
    }
    runLake(item.cwd, ["update"], `${item.label} lake update`, { required: true });
    runLake(item.cwd, ["exe", "cache", "get"], `${item.label} lake exe cache get`, { required: false });
    runLake(item.cwd, ["build"], `${item.label} lake build`, { required: true });
  }
}

report("prepare Lean build/cache", errors, warnings);

function runLake(cwd, args, label, options) {
  const result = spawnSync("lake", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    addProblem(`${label} failed to start: ${result.error.message}`, options);
    return result;
  }

  if (result.status !== 0) {
    addProblem(`${label} failed\n${result.stdout}${result.stderr}`.trim(), options);
  }

  return result;
}

function addProblem(message, options) {
  if (options.required) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}
