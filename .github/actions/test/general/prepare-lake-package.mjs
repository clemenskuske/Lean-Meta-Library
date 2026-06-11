// Shared Lake package preparation for statement and proof checks.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { maxBuildOutputBytes } from "../common.mjs";

export function ensureLakeAvailable(errors) {
  const result = spawnSync("lake", ["--version"], {
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`lake executable not found on PATH: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    errors.push(`lake --version failed\n${result.stdout}${result.stderr}`.trim());
    return false;
  }

  return true;
}

export function prepareLakePackage({ packageRoot, lakefilePath, label, errors, warnings }) {
  if (!lakefilePath) {
    return;
  }

  const lakefile = resolve(packageRoot, lakefilePath);
  const cwd = resolve(packageRoot, dirname(lakefilePath));

  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    errors.push(`${label} directory not found: ${cwd}`);
    return;
  }

  if (!existsSync(lakefile) || !statSync(lakefile).isFile()) {
    errors.push(`${label} lakefile not found: ${lakefilePath}`);
    return;
  }

  runLake(cwd, ["update"], `${label} lake update`, { required: true, errors, warnings });
  runLake(cwd, ["exe", "cache", "get"], `${label} lake exe cache get`, { required: false, errors, warnings });
  runLake(cwd, ["build"], `${label} lake build`, { required: true, errors, warnings });
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

function addProblem(message, { required, errors, warnings }) {
  if (required) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}
