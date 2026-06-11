// Shared Lake package preparation for statement and proof checks.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { maxBuildOutputBytes, walkFiles } from "../common.mjs";
import { loadLakeConfig } from "../lake-config.mjs";

const markerVersion = 1;
const lockTimeoutMs = 5 * 60 * 1000;
const staleLockMs = 10 * 60 * 1000;
const lakeCommandTimeoutMs = Number(process.env.LML_LAKE_COMMAND_TIMEOUT_MS ?? 20 * 60 * 1000);

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
  ensurePreparedLakePackage({ packageRoot, lakefilePath, label, kind: "package", errors, warnings });
}

export function ensurePreparedLakePackage({ packageRoot, lakefilePath, label, kind, errors, warnings = [] }) {
  if (!lakefilePath) {
    return null;
  }

  const resolved = resolveLakePackage({ packageRoot, lakefilePath, label, errors });
  if (!resolved) {
    return null;
  }

  if (!ensureLakeAvailable(errors)) {
    return resolved;
  }

  const runId = checkRunId();
  const markerPath = preparedMarkerPath(resolved.cwd, kind);
  if (hasCurrentMarker(markerPath, { runId, kind, lakefilePath })) {
    return { ...resolved, markerPath, skipped: true };
  }

  return withPrepareLock(resolved.cwd, kind, errors, () => {
    if (hasCurrentMarker(markerPath, { runId, kind, lakefilePath })) {
      return { ...resolved, markerPath, skipped: true };
    }

    warnAboutExistingBuild(resolved.cwd, markerPath, runId, label, warnings);

    const update = runLake(resolved.cwd, ["update"], `${label} lake update`, { required: true, errors, warnings });
    if (update.status !== 0 || update.error) {
      return { ...resolved, markerPath, skipped: false };
    }
    pruneLakePackageGitDirsForCi(resolved.cwd, warnings);

    const cacheArgs = cacheGetArgs(resolved.cwd, label, warnings);
    if (cacheArgs.length > 0) {
      runLake(resolved.cwd, ["exe", "cache", "get", ...cacheArgs], `${label} lake exe cache get`, { required: false, errors, warnings });
    } else {
      warnings.push(`${label} has no Lean library target for targeted cache fetch; skipping lake exe cache get`);
    }

    const build = runLake(resolved.cwd, ["build"], `${label} lake build`, { required: true, errors, warnings });
    if (build.status === 0 && !build.error) {
      writePreparedMarker(markerPath, {
        runId,
        kind,
        lakefilePath,
        packageDir: resolved.cwd,
        preparedAt: new Date().toISOString()
      });
      pruneLakePackageGitDirsForCi(resolved.cwd, warnings);
    }

    return { ...resolved, markerPath, skipped: false };
  });
}

function resolveLakePackage({ packageRoot, lakefilePath, label, errors }) {
  const lakefile = resolve(packageRoot, lakefilePath);
  const cwd = resolve(packageRoot, dirname(lakefilePath));

  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    errors.push(`${label} directory not found: ${cwd}`);
    return null;
  }

  if (!existsSync(lakefile) || !statSync(lakefile).isFile()) {
    errors.push(`${label} lakefile not found: ${lakefilePath}`);
    return null;
  }

  return { lakefile, cwd };
}

function checkRunId() {
  return process.env.LML_CHECK_RUN_ID || `standalone:${process.pid}`;
}

function preparedMarkerPath(cwd, kind) {
  return join(cwd, ".lake", `lml-${safeMarkerPart(kind)}-prepared.json`);
}

function hasCurrentMarker(markerPath, expected) {
  const marker = readPreparedMarker(markerPath);
  return Boolean(
    marker &&
      existsSync(join(dirname(markerPath), "build")) &&
      marker.markerVersion === markerVersion &&
      marker.runId === expected.runId &&
      marker.kind === expected.kind &&
      normalizePath(marker.lakefilePath) === normalizePath(expected.lakefilePath)
  );
}

function readPreparedMarker(markerPath) {
  if (!existsSync(markerPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

function writePreparedMarker(markerPath, marker) {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify({ markerVersion, ...marker }, null, 2), "utf8");
}

function warnAboutExistingBuild(cwd, markerPath, runId, label, warnings) {
  const buildDir = join(cwd, ".lake", "build");
  if (!existsSync(buildDir)) {
    return;
  }

  const marker = readPreparedMarker(markerPath);
  if (!marker) {
    warnings.push(`${label} has an existing Lake build without an LML preparation marker; refreshing it in place`);
    return;
  }
  if (marker.runId !== runId) {
    warnings.push(`${label} has a Lake build prepared for a previous run; refreshing it in place`);
  }
}

function withPrepareLock(cwd, kind, errors, body) {
  const lakeDir = join(cwd, ".lake");
  mkdirSync(lakeDir, { recursive: true });
  const lockDir = join(lakeDir, `lml-${safeMarkerPart(kind)}-prepare.lock`);
  const startedAt = Date.now();

  while (true) {
    try {
      mkdirSync(lockDir);
      writeFileSync(join(lockDir, "owner.json"), JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString()
      }), "utf8");
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        errors.push(`could not create Lake preparation lock ${lockDir}: ${error.message}`);
        return null;
      }

      if (isStaleLock(lockDir)) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }

      if (Date.now() - startedAt > lockTimeoutMs) {
        errors.push(`timed out waiting for Lake preparation lock: ${lockDir}`);
        return null;
      }
      sleep(100);
    }
  }

  try {
    return body();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function isStaleLock(lockDir) {
  try {
    return Date.now() - statSync(lockDir).mtimeMs > staleLockMs;
  } catch {
    return true;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function safeMarkerPart(value) {
  return String(value ?? "package").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function normalizePath(path) {
  return String(path ?? "").trim().split(sep).join("/").replace(/^\.?\//, "").replace(/\/$/g, "");
}

function runLake(cwd, args, label, options) {
  console.log(`::group::${label}`);
  console.log(`$ lake ${args.join(" ")}`);
  const result = spawnSync("lake", args, {
    cwd,
    env: lakeEnv(),
    stdio: "inherit",
    timeout: lakeCommandTimeoutMs
  });
  console.log(`::endgroup::`);

  if (result.error) {
    addProblem(`${label} failed to start: ${result.error.message}`, options);
    return result;
  }

  if (result.status !== 0) {
    addProblem(`${label} failed with exit code ${result.status}`, options);
  }

  if (result.signal) {
    addProblem(`${label} terminated by signal ${result.signal}`, options);
  }

  return result;
}

function lakeEnv() {
  return { ...process.env, MATHLIB_NO_CACHE_ON_UPDATE: "1" };
}

function addProblem(message, { required, errors, warnings }) {
  if (required) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}

function pruneLakePackageGitDirsForCi(cwd, warnings) {
  if (process.env.LML_PRUNE_LAKE_PACKAGES !== "1") {
    return;
  }

  const packagesDir = join(cwd, ".lake", "packages");
  if (!existsSync(packagesDir)) {
    return;
  }

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageDir = join(packagesDir, entry.name);
    try {
      pruneDependencyGitMetadata(packageDir);
    } catch (error) {
      warnings.push(`could not prune Lake dependency package ${entry.name}: ${error.message}`);
    }
  }
}

function cacheGetArgs(cwd, label, warnings) {
  const importedMathlibModules = mathlibImportModules(cwd);
  if (importedMathlibModules.length > 0) {
    return importedMathlibModules;
  }

  const configErrors = [];
  const config = loadLakeConfig(cwd, `${label} lakefile`, configErrors);
  if (configErrors.length > 0) {
    warnings.push(...configErrors);
  }
  return (config?.leanLibs ?? [])
    .map((lib) => lib.name)
    .filter(Boolean);
}

function mathlibImportModules(cwd) {
  const modules = new Set();
  for (const file of walkFiles(cwd)) {
    if (!file.endsWith(".lean")) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*import\s+([A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*)\s*$/);
      if (match && match[1].startsWith("Mathlib.")) {
        modules.add(match[1]);
      }
    }
  }
  return [...modules].sort();
}

function pruneDependencyGitMetadata(packageDir) {
  for (const entry of readdirSync(packageDir, { withFileTypes: true })) {
    if (entry.name === ".git") {
      rmSync(join(packageDir, entry.name), { recursive: true, force: true });
    } else if (entry.isDirectory() && entry.name !== ".lake") {
      pruneDependencyGitMetadata(join(packageDir, entry.name));
    }
  }
}
