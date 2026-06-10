#!/usr/bin/env node
// Prepares the submitted Lean packages before the checker suite fans out.
// Cache fetch is best-effort, but Lake update and package builds must pass.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  loadContext,
  maxBuildOutputBytes,
  packageRootForLakefile,
  proofLakefilePath,
  report,
  statementLakefilePath
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];
const packages = packageRoots();

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

function packageRoots() {
  const items = [];
  const seen = new Set();
  addPackage("statement/declaration package", statementLakefilePath(meta));
  addPackage("proof package", proofLakefilePath(meta));
  return items;

  function addPackage(label, lakefilePath) {
    if (!lakefilePath) {
      return;
    }
    const cwd = packageRootForLakefile(packageRoot, lakefilePath);
    if (!cwd || seen.has(cwd)) {
      return;
    }
    seen.add(cwd);
    items.push({ label, cwd, lakefilePath });
  }
}

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
