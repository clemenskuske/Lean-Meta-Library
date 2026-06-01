#!/usr/bin/env node
// Checks the two lakefiles and Lean imports for the first allowed dependency policy.
// It allows mathlib plus surface-package dependencies recorded in submissions.jsonl.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };
import {
  isConjectureProofEntry,
  leanFiles,
  listImports,
  loadContext,
  proofModuleForFile,
  readIfExists,
  relativePath,
  report,
  slugToPascal,
  surfaceModuleForEntry
} from "./common.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const warnings = [];
const submissionDependencies = loadSubmissionDependencies();
const allowedImportPrefixes = lmlEnv.submission?.allowedImportPrefixes ?? [];
const allowedImportsByLakefile = {
  root: new Set(),
  surface: new Set()
};
const localSurfaceModules = new Set((meta.surfaceEntries ?? []).map(surfaceModuleForEntry).filter(Boolean));
const surfaceEntryByFile = new Map(
  (meta.surfaceEntries ?? []).map((entry) => [normalizePath(`${entry.folder ?? ""}/Surface.lean`), entry])
);
const authorizedSurfaceImportsByFile = authorizedSurfaceImportsBySurfaceFile();
const authorizedSurfaceDependencyNamespaces = authorizedSurfaceNamespaces();
const localProofModules = new Set(
  (meta.proofs ?? [])
    .filter((proof) => !isConjectureProofEntry(proof))
    .map((proof) => proofModuleForFile(proof.proofFile))
    .filter(Boolean)
);

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
    const verdict = importVerdict(imported, file, allowedExternalImportsFor(file));
    if (verdict.warning) {
      warnings.push(verdict.warning);
    }
    if (!verdict.allowed) {
      errors.push(verdict.error ?? `${relativePath(packageRoot, file)} imports disallowed module: ${imported}`);
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

    if (dependency.name.endsWith(".Proofs")) {
      warnings.push(`${label} imports proof package dependency ${dependency.name}; proof dependencies are accepted with a warning`);
      allowedExternalImports.add(dependency.name);
      continue;
    }

    if (!dependency.name.endsWith(".Surface")) {
      errors.push(`${label} dependency must require a surface package, found ${dependency.name}`);
      continue;
    }

    const dependencyNamespace = dependency.name.replace(/\.Surface$/, "");
    if (dependencyNamespace === namespaceRoot) {
      errors.push(`${label} surface dependency must use a different namespace: ${dependency.name}`);
      continue;
    }
    if (!authorizedSurfaceDependencyNamespaces.has(dependencyNamespace)) {
      errors.push(`${label} surface dependency ${dependency.name} is not listed in metadata usedSurfaceFiles`);
      continue;
    }

    allowedExternalImports.add(dependency.name);
  }
}

function checkMathlibDependency(dependency, label) {
  if (normalizeGitUrl(dependency.url) !== normalizeGitUrl(`https://github.com/${lmlEnv.mathlib.repository}.git`)) {
    errors.push(`${label} dependency URL is not allowed for mathlib: ${dependency.url}`);
  }
  if (dependency.ref !== lmlEnv.mathlib.revision) {
    errors.push(`${label} dependency ref must match lml-env.json mathlib.revision: ${dependency.ref ?? "(missing)"}`);
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

function importVerdict(imported, file, allowedExternalImports) {
  const rel = relativePath(packageRoot, file);
  if ((rel === "lakefile.lean" || rel === "surface-package/lakefile.lean") && imported === "Lake") {
    return { allowed: true };
  }
  const isSurfacePackageFile = rel.startsWith("surface-package/");
  const isProofPackageFile = rel.startsWith("proofs/");
  const isOwnSurfaceImport =
    namespaceRoot && (imported === `${namespaceRoot}.Surface` || imported.startsWith(`${namespaceRoot}.Surface.`));
  const isOwnSurfaceEntryImport = localSurfaceModules.has(imported);
  const isOwnProofModuleImport = !isSurfacePackageFile && localProofModules.has(imported);
  const isAllowedExternalImport = [...allowedExternalImports].some((prefix) => imported === prefix || imported.startsWith(`${prefix}.`));

  if (hasAllowedImportPrefix(imported)) {
    return { allowed: true };
  }

  if (isSurfacePackageFile) {
    return surfaceFileImportVerdict({ imported, rel, isOwnSurfaceEntryImport, isOwnSurfaceImport, isAllowedExternalImport });
  }

  if (isProofPackageFile && isAllowedExternalImport && isProofImport(imported)) {
    return {
      allowed: true,
      warning: `${rel} imports proof dependency ${imported}; proof dependencies are accepted with a warning`
    };
  }

  if (isProofPackageFile && (isOwnSurfaceEntryImport || isOwnSurfaceImport || isAllowedExternalImport)) {
    return {
      allowed: true,
      warning: proofSurfaceImportWarning({ imported, rel })
    };
  }

  if (!isSurfacePackageFile && isOwnSurfaceEntryImport) {
    return { allowed: true };
  }
  if (isOwnProofModuleImport) {
    return { allowed: true };
  }
  if (isOwnSurfaceImport) {
    return { allowed: true };
  }
  if (isAllowedExternalImport) {
    return { allowed: true };
  }

  return { allowed: false };
}

function surfaceFileImportVerdict({ imported, rel, isOwnSurfaceEntryImport, isOwnSurfaceImport, isAllowedExternalImport }) {
  if (!isOwnSurfaceEntryImport && !isOwnSurfaceImport && !isAllowedExternalImport) {
    return { allowed: false };
  }
  if (isOwnSurfaceEntryImport || isOwnSurfaceImport) {
    return { allowed: true };
  }

  const entry = surfaceEntryByFile.get(rel);
  const authorized = authorizedSurfaceImportsByFile.get(rel);
  if (!entry || !authorized) {
    return {
      allowed: false,
      error: `${rel} imports surface module ${imported}, but this surface entry has no usedSurfaceFiles metadata`
    };
  }

  if (!authorized.modules.has(imported) && ![...authorized.prefixes].some((prefix) => imported === prefix || imported.startsWith(`${prefix}.`))) {
    return {
      allowed: false,
      error: `${rel} imports surface module ${imported}, but it is not listed in that entry's usedSurfaceFiles metadata`
    };
  }

  const sameNamespaceUse = [...authorized.definitions].some((definition) => namespaceOfDeclaration(definition) === entry.name);
  if (sameNamespaceUse) {
    return {
      allowed: false,
      error: `${rel} usedSurfaceFiles must point to a different namespace than ${entry.name}`
    };
  }

  return { allowed: true };
}

function proofSurfaceImportWarning({ imported, rel }) {
  return `${rel} imports surface module ${imported}; proof surface dependencies are accepted with a warning`;
}

function hasAllowedImportPrefix(imported) {
  return allowedImportPrefixes.some((prefix) => {
    const normalized = String(prefix ?? "").trim();
    if (!normalized) {
      return false;
    }
    return normalized.endsWith(".")
      ? imported.startsWith(normalized)
      : imported === normalized || imported.startsWith(`${normalized}.`);
  });
}

function isProofImport(imported) {
  return imported.endsWith(".Proofs") || imported.includes(".Proofs.");
}

function authorizedSurfaceImportsBySurfaceFile() {
  const byFile = new Map();
  for (const entry of meta.surfaceEntries ?? []) {
    const rel = normalizePath(`${entry.folder ?? ""}/Surface.lean`);
    const authorized = {
      modules: new Set(),
      prefixes: new Set(),
      definitions: new Set()
    };

    for (const used of entry.usedSurfaceFiles ?? []) {
      const moduleName = moduleFromSurfaceFile(used.surfaceFile);
      if (moduleName) {
        authorized.modules.add(moduleName);
      }

      const definition = stringValue(used.definition);
      if (definition) {
        authorized.definitions.add(definition);
        const namespace = namespaceRootForDefinition(definition) ?? namespaceRootForSlug(used.slug);
        if (namespace) {
          authorized.prefixes.add(`${namespace}.Surface`);
        }
      }
    }

    byFile.set(rel, authorized);
  }
  return byFile;
}

function authorizedSurfaceNamespaces() {
  const namespaces = new Set();
  for (const entry of meta.surfaceEntries ?? []) {
    for (const used of entry.usedSurfaceFiles ?? []) {
      const definition = stringValue(used.definition);
      const namespace = namespaceRootForDefinition(definition) ?? namespaceRootForSlug(used.slug);
      if (namespace && namespace !== namespaceRoot) {
        namespaces.add(namespace);
      }
    }
  }
  return namespaces;
}

function moduleFromSurfaceFile(surfaceFile) {
  const parts = normalizePath(surfaceFile).split("/").filter(Boolean);
  if (parts.at(-1) !== "Surface.lean" || parts.length < 2) {
    return null;
  }
  return `${parts.at(-2)}.Surface`;
}

function namespaceRootForDefinition(definition) {
  const match = stringValue(definition).match(/^([A-Za-z_][A-Za-z0-9_']*)\.Surface\./);
  return match?.[1] ?? null;
}

function namespaceRootForSlug(slug) {
  const value = stringValue(slug);
  return value ? slugToPascal(value) : null;
}

function namespaceOfDeclaration(name) {
  const value = stringValue(name);
  const index = value.lastIndexOf(".");
  return index === -1 ? value : value.slice(0, index);
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

report("dependency check", errors, warnings);
