#!/usr/bin/env node
// Checks Lake dependencies and Lean imports against the declared dependency policy.
// New metadata uses Package/File/Name records; old local Slug.Surface dependencies remain tolerated during migration.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import { validateSubmissionRow } from "../submission-schema.mjs";
import { loadContext } from "./general/meta-context.mjs";
import {
  leanFiles,
  metadataProofs,
  metadataStatements,
  namespaceOfDeclaration,
  packageRootForLakefile,
  proofFileForProofEntry,
  proofLakefilePath,
  readIfExists,
  relativePath,
  report,
  statementLakefilePath,
  statementLeanFileForEntry,
  theoremFileForProofEntry,
  theoremNameForProofEntry
} from "./common.mjs";
import { lakeDependencies, lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const warnings = [];
const submissionDependencies = loadSubmissionDependencies();
const baseImports = lmlEnv.baseImports ?? {};
const toolchainImportPrefixes = lmlEnv.lean?.version ? ["Std."] : [];
const allowedBaseImportPrefixes = [
  ...Object.values(baseImports).map((item) => item?.importPrefix).filter(Boolean),
  ...toolchainImportPrefixes
];
const mathlib = baseImports.Mathlib ?? {};
const statementRoot = statementLakefilePath(meta) ? packageRootForLakefile(packageRoot, statementLakefilePath(meta)) : null;
const proofRoot = proofLakefilePath(meta) ? packageRootForLakefile(packageRoot, proofLakefilePath(meta)) : null;
const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement/declaration lakefile", errors) : null;
const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;
const statements = metadataStatements(meta);
const proofs = metadataProofs(meta);
const statementModuleByName = statementModulesByName();
const localStatementModules = new Set(
  [...statementModuleByName.values()]
);
const localProofModules = new Set(
  proofs
    .map(proofFileForProofEntry)
    .filter(Boolean)
    .map((file) => lakeModuleForFile(proofLakeConfig, proofRoot, join(packageRoot, file)))
    .filter(Boolean)
);
const statementPolicyByFile = policyByStatementFile();
const proofPolicyByFile = policyByProofFile();
const allowedExternalPackages = declaredExternalPackages();
const allowedImportsByLakefile = {
  statement: new Set(),
  proof: new Set()
};

checkLakefile(statementLakeConfig, "statement/declaration lakefile", allowedImportsByLakefile.statement);
checkLakefile(proofLakeConfig, "proof lakefile", allowedImportsByLakefile.proof);

const files = leanFiles(packageRoot);
const importsByFile = parseLeanImports(files, errors);

for (const file of files) {
  const source = readIfExists(file);
  if (!source) {
    continue;
  }

  for (const imported of importsByFile.get(file) ?? []) {
    const verdict = importVerdict(imported, file, allowedExternalImportsFor(file));
    if (verdict.warning) {
      warnings.push(verdict.warning);
    }
    if (!verdict.allowed) {
      errors.push(verdict.error ?? `${relativePath(packageRoot, file)} imports disallowed module: ${imported}`);
    }
  }
}

function checkLakefile(config, label, allowedExternalImports) {
  if (!config) {
    return;
  }

  const requires = lakeDependencies(config);
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
    if (submissionDependencies.length > 0 && !submission) {
      errors.push(`${label} dependency is not allowed by submissions.jsonl: ${formatDependency(dependency)}`);
      continue;
    }

    if (!packageSetAllows(allowedExternalPackages, dependency.name)) {
      errors.push(`${label} dependency ${dependency.name} is not listed in metadata DeclarationReferences`);
      continue;
    }

    allowedExternalImports.add(dependency.name);
  }
}

function checkMathlibDependency(dependency, label) {
  if (normalizeGitUrl(dependency.url) !== normalizeGitUrl(`https://github.com/${mathlib.repository}.git`)) {
    errors.push(`${label} dependency URL is not allowed for mathlib: ${dependency.url}`);
  }
  if (dependency.ref !== mathlib.revision) {
    errors.push(`${label} dependency ref must match lml-env.json baseImports.Mathlib.revision: ${dependency.ref ?? "(missing)"}`);
  }
  if (dependency.subDir) {
    errors.push(`${label} mathlib dependency should not specify a subdirectory`);
  }
}

function checkLocalDependency(dependency, label) {
  const legacySurface = namespaceRoot && dependency.name === `${namespaceRoot}.Surface` && normalizePath(dependency.path) === "surface-package";
  const localStatements = namespaceRoot && dependency.name === `${namespaceRoot}.Statements`;
  if (legacySurface || localStatements) {
    return;
  }
  errors.push(`${label} local dependency is not allowed: ${formatDependency(dependency)}`);
}

function allowedExternalImportsFor(file) {
  return isInStatementPackage(file) ? allowedImportsByLakefile.statement : allowedImportsByLakefile.proof;
}

function importVerdict(imported, file, allowedExternalImports) {
  const rel = relativePath(packageRoot, file);
  if (isLakefile(rel) && imported === "Lake") {
    return { allowed: true };
  }
  if (hasAllowedImportPrefix(imported)) {
    return { allowed: true };
  }

  const isStatementFile = statementPolicyByFile.has(normalizePath(rel));
  const isProofFile = proofPolicyByFile.has(normalizePath(rel));
  const proofPolicy = proofPolicyByFile.get(normalizePath(rel));
  const isOwnStatementImport = localStatementModules.has(imported) || isOwnPackageImport(imported, "Statements") || isOwnLegacySurfaceImport(imported);
  const isOwnProofImport = localProofModules.has(imported) || isOwnPackageImport(imported, "Proofs");
  const isAllowedExternalImport = [...allowedExternalImports].some((prefix) => imported === prefix || imported.startsWith(`${prefix}.`));

  if (isStatementFile) {
    return metadataAuthorizedImportVerdict({
      imported,
      rel,
      policy: statementPolicyByFile.get(normalizePath(rel)),
      kind: "statement/declaration",
      isOwnImport: isOwnStatementImport,
      isAllowedExternalImport
    });
  }

  if (isProofFile) {
    return metadataAuthorizedImportVerdict({
      imported,
      rel,
      policy: proofPolicy,
      kind: "proof",
      isOwnImport: isOwnProofImport || proofPolicy?.ownModules.has(imported),
      isAllowedExternalImport: isAllowedExternalImport || localStatementModules.has(imported)
    });
  }

  if (isOwnStatementImport || isOwnProofImport || isAllowedExternalImport) {
    return { allowed: true };
  }

  return { allowed: false };
}

function metadataAuthorizedImportVerdict({ imported, rel, policy, kind, isOwnImport, isAllowedExternalImport }) {
  if (isOwnImport) {
    return { allowed: true };
  }
  if (!isAllowedExternalImport) {
    return { allowed: false };
  }
  if (!policy) {
    return {
      allowed: false,
      error: `${rel} imports ${imported}, but this ${kind} file is not linked to metadata`
    };
  }
  if (packageSetAllows(policy.packages, imported)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    error: `${rel} imports ${imported}, but it is not listed in that entry's DeclarationReferences metadata`
  };
}

function policyByStatementFile() {
  const byFile = new Map();
  for (const entry of statements) {
    const file = normalizePath(statementLeanFileForEntry(entry));
    if (!file) {
      continue;
    }
    byFile.set(file, {
      packages: new Set(entry.usedSurfaceFiles.map((used) => used.package).filter(Boolean))
    });
  }
  return byFile;
}

function policyByProofFile() {
  const byFile = new Map();
  for (const proof of proofs) {
    const file = normalizePath(proofFileForProofEntry(proof));
    if (!file) {
      continue;
    }
    const ownModules = new Set();
    const ownStatementModule = statementModuleForProof(proof);
    if (ownStatementModule) {
      ownModules.add(ownStatementModule);
    }
    byFile.set(file, {
      ownModules,
      packages: new Set(proof.usedSurfaceFiles.map((used) => used.package).filter(Boolean))
    });
  }
  return byFile;
}

function statementModulesByName() {
  const byName = new Map();
  for (const entry of statements) {
    const file = statementLeanFileForEntry(entry);
    const moduleName = file ? lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, file)) : null;
    if (!moduleName || !entry.name) {
      continue;
    }
    byName.set(entry.name, moduleName);
    byName.set(namespaceOfDeclaration(entry.name), moduleName);
  }
  return byName;
}

function statementModuleForProof(proof) {
  const theoremFile = theoremFileForProofEntry(proof);
  if (theoremFile) {
    return lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, theoremFile));
  }

  const theoremName = theoremNameForProofEntry(proof);
  return statementModuleByName.get(theoremName) ?? statementModuleByName.get(namespaceOfDeclaration(theoremName));
}

function declaredExternalPackages() {
  const packages = new Set();
  for (const entry of statements) {
    for (const used of entry.usedSurfaceFiles) {
      if (used.package) {
        packages.add(used.package);
      }
    }
  }
  for (const proof of proofs) {
    for (const used of proof.usedSurfaceFiles) {
      if (used.package) {
        packages.add(used.package);
      }
    }
  }
  return packages;
}

function isInStatementPackage(file) {
  return statementRoot && isInsidePath(statementRoot, file);
}

function isLakefile(rel) {
  return rel === "lakefile.lean" || rel.endsWith("/lakefile.lean");
}

function isOwnPackageImport(imported, mode) {
  return namespaceRoot && (imported === `${namespaceRoot}.${mode}` || imported.startsWith(`${namespaceRoot}.${mode}.`));
}

function isOwnLegacySurfaceImport(imported) {
  return namespaceRoot && (imported === `${namespaceRoot}.Surface` || imported.startsWith(`${namespaceRoot}.Surface.`));
}

function hasAllowedImportPrefix(imported) {
  return allowedBaseImportPrefixes.some((prefix) => {
    const normalized = String(prefix ?? "").trim();
    if (!normalized) {
      return false;
    }
    return normalized.endsWith(".")
      ? imported.startsWith(normalized)
      : imported === normalized || imported.startsWith(`${normalized}.`);
  });
}

function packagePrefix(imported) {
  const parts = String(imported ?? "").split(".");
  if (parts.length >= 2 && ["Statements", "Proofs", "Surface"].includes(parts[1])) {
    return `${parts[0]}.${parts[1]}`;
  }
  return parts[0] ?? "";
}

function packageSetAllows(packages, imported) {
  return [...packages].some((pkg) => {
    if (!pkg) {
      return false;
    }
    return imported === pkg || imported.startsWith(`${pkg}.`) || packagePrefix(imported) === pkg;
  });
}

function findMatchingSubmissionDependency(dependency) {
  return submissionDependencies.find((submission) => {
    const expectedRef = submission.sourceCommit || submission.sourceBranch;
    return (
      normalizeGitUrl(dependency.url) === normalizeGitUrl(submission.repoUrl) &&
      dependency.ref === expectedRef &&
      (!dependency.subDir || submission.packageFolders.has(normalizePath(dependency.subDir)))
    );
  });
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

  const validation = validateSubmissionRow(row);
  if (!validation.valid) {
    errors.push(
      `${path}:${lineNumber} does not match submissions.jsonl schema: ${validation.errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ")}`
    );
  }

  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value])
  );
  const packageFolders = new Set([
    normalized.surfacefolder,
    normalized.statementfolder,
    normalized.declarationfolder,
    normalized.lakestatementpackage,
    normalized.lakeproofpackage
  ].map(normalizePath).filter(Boolean));

  const dependency = {
    repoUrl: stringValue(normalized.repourl ?? normalized.gitrepo ?? normalized.githubrepo),
    sourceBranch: stringValue(normalized.sourcebranch),
    sourceCommit: stringValue(normalized.sourcecommit),
    packageFolders
  };

  for (const [key, value] of Object.entries({
    repoUrl: dependency.repoUrl,
    sourceBranch: dependency.sourceBranch,
    sourceCommit: dependency.sourceCommit
  })) {
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

function isInsidePath(parent, child) {
  const rel = relativePath(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
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
