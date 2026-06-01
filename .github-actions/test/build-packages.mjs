#!/usr/bin/env node
// Runs `lake build` for both the root proof package and the nested surface package.
// This is the expensive check that confirms Lean accepts both packages.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { loadContext, report } from "./common.mjs";

const { packageRoot } = loadContext();
const errors = [];

if (spawnSync("lake", ["--version"], { encoding: "utf8" }).error) {
  errors.push("lake executable not found on PATH");
} else {
  runLakeBuild(packageRoot, "proof package");
  runLakeBuild(join(packageRoot, "surface-package"), "surface package");
}

function runLakeBuild(cwd, label) {
  const result = spawnSync("lake", ["build"], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.status !== 0) {
    errors.push(`${label} failed to build\n${result.stdout}${result.stderr}`.trim());
  }
}

report("build both packages", errors);
