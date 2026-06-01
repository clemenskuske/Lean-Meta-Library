#!/usr/bin/env node
// Checks the two lakefiles and Lean imports for the first allowed dependency policy.
// Currently it allows only the mathlib git dependency plus Mathlib, Std, and local surface imports.
import { join } from "node:path";
import { leanFiles, listImports, loadContext, readIfExists, relativePath, report } from "./common.mjs";

const { packageRoot, namespaceRoot } = loadContext();
const errors = [];

checkLakefile(join(packageRoot, "lakefile.lean"), "root lakefile");
checkLakefile(join(packageRoot, "surface-package/lakefile.lean"), "surface lakefile");

for (const file of leanFiles(packageRoot)) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }

  for (const imported of listImports(source)) {
    if (!isAllowedImport(imported, file)) {
      errors.push(`${relativePath(packageRoot, file)} imports disallowed module: ${imported}`);
    }
  }
}

function checkLakefile(path, label) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }

  const requires = [...source.matchAll(/\brequire\s+([A-Za-z0-9_-]+)\s+from\s+git\s+"([^"]+)"\s+@\s+"([^"]+)"/g)];
  if (requires.length !== 1) {
    errors.push(`${label} should have exactly one git dependency`);
    return;
  }

  const [match, name, url, ref] = requires[0];
  void match;
  if (name !== "mathlib") {
    errors.push(`${label} dependency must be mathlib, found ${name}`);
  }
  if (url !== "https://github.com/leanprover-community/mathlib4.git") {
    errors.push(`${label} dependency URL is not allowed: ${url}`);
  }
  if (!/^(stable|master|v?\d|nightly-|release-)/.test(ref)) {
    errors.push(`${label} dependency ref looks suspicious: ${ref}`);
  }
}

function isAllowedImport(imported, file) {
  const rel = relativePath(packageRoot, file);
  if ((rel === "lakefile.lean" || rel === "surface-package/lakefile.lean") && imported === "Lake") {
    return true;
  }

  return (
    imported.startsWith("Mathlib.") ||
    imported.startsWith("Std.") ||
    (namespaceRoot && imported.startsWith(`${namespaceRoot}.Surface.`))
  );
}

report("dependency check", errors);
