#!/usr/bin/env node
// Checks the two lakefiles and Lean imports for the first allowed dependency policy.
// It allows mathlib plus surface-package dependencies recorded in submissions.jsonl.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };
import { leanFiles, listImports, loadContext, readIfExists, relativePath, report, surfaceModuleForEntry } from "./common.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const submissionDependencies = loadSubmissionDependencies();
const allowedImportsByLakefile = {
  root: new Set(),
  surface: new Set()
};
const localSurfaceModules = new Set((meta.surfaceEntries ?? []).map(surfaceModuleForEntry).filter(Boolean));

checkLakefile(join(packageRoot, "lakefile.lean"), "root lakefile", allowedImportsByLakefile.root);
checkLakefile(
  join(packageRoot, "surface-package/lakefile.lean"),
  "surface lakefile",
  allowedImportsByLakefile.surface
);

for (const file of leanFiles(packageRoot)) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }

  for (const imported of listImports(source)) {
    if (!isAllowedImport(imported, file, allowedExternalImportsFor(file))) {
      errors.push(`${relativePath(packageRoot, file)} imports disallowed module: ${imported}`);
    }
  }
}

function checkLakefile(path, label, allowedExternalImports) {
  const source = readIfExists(path);
  if (!source) {
    return;
  }

  const requires = parseLakeRequires(source);
  const mathlibRequires = requires.filter((dependency) => dependency.kind === "git" && dependency.name === "mathlib");
  if (mathlibRequires.length !== 1) {
    errors.push(`${label} should have exactly one mathlib git dependency`);
    return;
  }

  checkMathlibDependency(mathlibRequires[0], label);

  for (const dependency of requires.filter((item) => item.name !== "mathlib")) {
    if (dependency.kind === "local") {
      checkLocalDependency(dependency, label);
      continue;
    }

    const submission = findMatchingSubmissionDependency(dependency);
    if (!submission) {
      errors.push(`${label} dependency is not allowed by submissions.jsonl: ${formatDependency(dependency)}`);
      continue;
    }

    if (!dependency.name.endsWith(".Surface")) {
      errors.push(`${label} dependency must require only a surface package, found ${dependency.name}`);
      continue;
    }

    allowedExternalImports.add(dependency.name);
  }
}

function checkMathlibDependency(dependency, label) {
  if (normalizeGitUrl(dependency.url) !== normalizeGitUrl(`https://github.com/${lmlEnv.mathlib.repository}.git`)) {
    errors.push(`${label} dependency URL is not allowed for mathlib: ${dependency.url}`);
  }
  if (!dependency.ref || !/^(stable|master|v?\d|nightly-|release-)/.test(dependency.ref)) {
    errors.push(`${label} dependency ref looks suspicious for mathlib: ${dependency.ref ?? "(missing)"}`);
  }
  if (dependency.subDir) {
    errors.push(`${label} mathlib dependency should not specify a subdirectory`);
  }
}

function checkLocalDependency(dependency, label) {
  if (label !== "root lakefile" || dependency.name !== `${namespaceRoot}.Surface` || normalizePath(dependency.path) !== "surface-package") {
    errors.push(`${label} local dependency is not allowed: ${formatDependency(dependency)}`);
  }
}

function parseLakeRequires(source) {
  const gitRequires = [...source.matchAll(/\brequire\s+([A-Za-z0-9_.-]+)\s+from\s+git\s+"([^"]+)"(?:\s+@\s+"([^"]+)")?(?:\s+\/\s+"([^"]+)")?/g)].map(
    ([, name, url, ref, subDir]) => ({ kind: "git", name, url, ref, subDir })
  );
  const localRequires = [...source.matchAll(/\brequire\s+([A-Za-z0-9_.-]+)\s+from\s+"([^"]+)"/g)].map(
    ([, name, path]) => ({ kind: "local", name, path })
  );
  return [...gitRequires, ...localRequires];
}

function findMatchingSubmissionDependency(dependency) {
  return submissionDependencies.find((submission) => {
    const expectedRef = submission.sourceCommit || submission.sourceBranch;
    return (
      normalizeGitUrl(dependency.url) === normalizeGitUrl(submission.repoUrl) &&
      dependency.ref === expectedRef &&
      normalizePath(dependency.subDir) === normalizePath(submission.surfaceFolder)
    );
  });
}

function allowedExternalImportsFor(file) {
  const rel = relativePath(packageRoot, file);
  return rel.startsWith("surface-package/") ? allowedImportsByLakefile.surface : allowedImportsByLakefile.root;
}

function isAllowedImport(imported, file, allowedExternalImports) {
  const rel = relativePath(packageRoot, file);
  if ((rel === "lakefile.lean" || rel === "surface-package/lakefile.lean") && imported === "Lake") {
    return true;
  }

  const isSurfacePackageFile = rel.startsWith("surface-package/");
  const isOwnSurfaceImport =
    namespaceRoot && (imported === `${namespaceRoot}.Surface` || imported.startsWith(`${namespaceRoot}.Surface.`));

  return (
    imported.startsWith("Mathlib.") ||
    imported.startsWith("Std.") ||
    (isSurfacePackageFile && localSurfaceModules.has(imported)) ||
    isOwnSurfaceImport ||
    [...allowedExternalImports].some((prefix) => imported === prefix || imported.startsWith(`${prefix}.`))
  );
}

function loadSubmissionDependencies() {
  const path = findSubmissionsJsonl();
  if (!path || !existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseSubmissionDependency(line, path, index + 1))
    .filter(Boolean);
}

function parseSubmissionDependency(line, path, lineNumber) {
  let row;
  try {
    row = JSON.parse(line);
  } catch (error) {
    errors.push(`${path}:${lineNumber} is not valid JSON: ${error.message}`);
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value])
  );
  const dependency = {
    repoUrl: stringValue(normalized.repourl),
    sourceBranch: stringValue(normalized.sourcebranch),
    sourceCommit: stringValue(normalized.sourcecommit),
    surfaceFolder: stringValue(normalized.surfacefolder)
  };

  for (const [key, value] of Object.entries(dependency)) {
    if (!value) {
      errors.push(`${path}:${lineNumber} is missing ${key}`);
    }
  }

  return dependency;
}

function findSubmissionsJsonl() {
  for (const start of [packageRoot, process.cwd()]) {
    let dir = resolve(start);
    while (true) {
      const candidate = join(dir, "submissions.jsonl");
      if (existsSync(candidate)) {
        return candidate;
      }

      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  return null;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGitUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/$/g, "");
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

function formatDependency(dependency) {
  if (dependency.kind === "local") {
    return `${dependency.name} from ${dependency.path}`;
  }
  const subDir = dependency.subDir ? ` / "${dependency.subDir}"` : "";
  const ref = dependency.ref ? ` @ "${dependency.ref}"` : "";
  return `${dependency.name} from ${dependency.url}${ref}${subDir}`;
}

report("dependency check", errors);
