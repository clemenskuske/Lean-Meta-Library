#!/usr/bin/env node
// Runs `lake build` for both the statement package and the proof package.
// This is the expensive check that confirms Lean accepts both packages.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { loadContext } from "./meta-context.mjs";
import {
  maxBuildOutputBytes,
  proofPackageRoot,
  report,
  statementPackageRoot
} from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];

const lakeVersion = spawnSync("lake", ["--version"], {
  encoding: "utf8",
  maxBuffer: maxBuildOutputBytes
});
if (lakeVersion.error) {
  errors.push(`lake executable not found on PATH: ${lakeVersion.error.message}`);
} else if (lakeVersion.status !== 0) {
  errors.push(`lake --version failed\n${lakeVersion.stdout}${lakeVersion.stderr}`.trim());
} else {
  for (const item of packageRoots()) {
    runLakeBuild(item.cwd, item.label);
  }
}

function packageRoots() {
  const items = [];
  const seen = new Set();
  addPackage("statement package", statementPackageRoot(meta));
  addPackage("proof package", proofPackageRoot(meta));
  return items;

  function addPackage(label, packageFolderPath) {
    if (!packageFolderPath) {
      return;
    }
    const cwd = resolve(packageRoot, packageFolderPath);
    if (seen.has(cwd)) {
      return;
    }
    seen.add(cwd);
    items.push({ label, cwd });
  }
}

function runLakeBuild(cwd, label) {
  const result = spawnSync("lake", ["build"], {
    cwd,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`${label} lake build failed to start: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    errors.push(`${label} failed to build\n${result.stdout}${result.stderr}`.trim());
  }
}

report("build both packages", errors);
