#!/usr/bin/env node
// Checks statement-package Lake dependencies and Lean imports against metadata.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { validateSubmissionRow } from "../../submission-schema.mjs";
import { leanFiles, namespaceOfDeclaration, packageRootForLakefile, relativePath, report, statementLakefilePath } from "../common.mjs";
import { lakeDependencies, lakeModuleForFile, loadLakeConfig } from "../lake-config.mjs";
import { parseLeanImports } from "../lean-imports.mjs";
import { loadContext, slugToPascal } from "../general/meta-context.mjs";

const { packageRoot, meta, namespaceRoot } = loadContext();
const errors = [];
const submissionDependencies = loadSubmissionDependencies();
const baseImports = lmlEnv.baseImports ?? {};
const allowedBaseImportPrefixes = [
  ...Object.values(baseImports).map((item) => item?.importPrefix).filter(Boolean),
  ...(lmlEnv.lean?.version ? ["Std."] : [])
];
const statementLakefile = statementLakefilePath(meta);
const statementRoot = statementLakefile ? packageRootForLakefile(packageRoot, statementLakefile) : null;
const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement lakefile", errors) : null;
const statements = Array.isArray(meta.statements) ? meta.statements : [];
const statementModuleByName = statementModulesByName();
const localStatementModules = new Set([...statementModuleByName.values()]);
const statementPolicyByFile = policyByStatementFile();
const metadataExternalPackages = declaredExternalPackages();
const allowedExternalImports = new Set();

checkStatementLakefile();
checkStatementLeanImports();

function checkStatementLakefile() {
  if (!statementLakeConfig) {
    return;
  }

  for (const dependency of lakeDependencies(statementLakeConfig)) {
    if (isBaseDependency(dependency)) {
      continue;
    }
    if (dependency.kind === "local") {
      errors.push(`statement lakefile local dependency is not allowed: ${formatDependency(dependency)}`);
      continue;
    }

    const submission = findMatchingSubmissionDependency(dependency);
    if (submissionDependencies.length > 0 && !submission) {
      errors.push(`statement lakefile dependency is not allowed by submissions.jsonl: ${formatDependency(dependency)}`);
      continue;
    }
    if (!packageSetAllows(metadataExternalPackages, dependency.name)) {
      errors.push(`statement lakefile dependency ${dependency.name} is not listed in metadata DeclarationReferences`);
      continue;
    }

    allowedExternalImports.add(dependency.name);
  }
}

function checkStatementLeanImports() {
  if (!statementRoot) {
    return;
  }

  const files = leanFiles(statementRoot);
  const importsByFile = parseLeanImports(files, errors);

  for (const file of files) {
    for (const imported of importsByFile.get(file) ?? []) {
      const verdict = importVerdict(imported, file);
      if (!verdict.allowed) {
        errors.push(verdict.error ?? `${relativePath(packageRoot, file)} imports disallowed module: ${imported}`);
      }
    }
  }
}

function importVerdict(imported, file) {
  const rel = normalizePath(relativePath(packageRoot, file));
  if (isLakefile(rel) && imported === "Lake") {
    return { allowed: true };
  }
  if (hasAllowedImportPrefix(imported)) {
    return { allowed: true };
  }
  if (isOwnStatementImport(imported)) {
    return { allowed: true };
  }

  const policy = statementPolicyByFile.get(rel);
  if (!policy) {
    return {
      allowed: false,
      error: `${rel} imports ${imported}, but this statement file is not linked to metadata`
    };
  }

  const isAllowedByLakefile = packageSetAllows(allowedExternalImports, imported);
  if (!isAllowedByLakefile) {
    return {
      allowed: false,
      error: `${rel} imports ${imported}, but the statement lakefile does not declare an authorized dependency for it`
    };
  }
  if (packageSetAllows(policy.packages, imported)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: `${rel} imports ${imported}, but it is not listed in that statement entry's DeclarationReferences metadata`
  };
}

function policyByStatementFile() {
  const byFile = new Map();
  for (const entry of statements) {
    const file = normalizePath(entry?.Statement?.LeanStatement);
    if (!file) {
      continue;
    }
    byFile.set(file, {
      packages: new Set(declarationReferences(entry).map(referencePackage).filter(Boolean))
    });
  }
  return byFile;
}

function statementModulesByName() {
  const byName = new Map();
  if (!statementLakeConfig || !statementRoot) {
    return byName;
  }

  for (const entry of statements) {
    const name = entry?.Statement?.Name;
    const file = entry?.Statement?.LeanStatement;
    const moduleName = file ? lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, file)) : null;
    if (!name || !moduleName) {
      continue;
    }
    byName.set(name, moduleName);
    byName.set(namespaceOfDeclaration(name), moduleName);
  }
  return byName;
}

function declaredExternalPackages() {
  const packages = new Set();
  for (const entry of statements) {
    for (const reference of declarationReferences(entry)) {
      const pkg = referencePackage(reference);
      if (pkg) {
        packages.add(pkg);
      }
    }
  }
  return packages;
}

function referencePackage(reference) {
  if (reference?.SubmissionSlug) {
    return `${slugToPascal(reference.SubmissionSlug)}.Statements`;
  }
  return null;
}

function declarationReferences(entry) {
  return Array.isArray(entry?.DeclarationReferences) ? entry.DeclarationReferences : [];
}

function isBaseDependency(dependency) {
  return Object.values(baseImports).some((item) => item?.lakeDependency === dependency.name);
}

function isLakefile(rel) {
  return rel === "lakefile.lean" || rel.endsWith("/lakefile.lean");
}

function isOwnStatementImport(imported) {
  return localStatementModules.has(imported) || isOwnPackageImport(imported, "Statements");
}

function isOwnPackageImport(imported, mode) {
  return namespaceRoot && (imported === `${namespaceRoot}.${mode}` || imported.startsWith(`${namespaceRoot}.${mode}.`));
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
  if (parts.length >= 2 && parts[1] === "Statements") {
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
    normalized.statementfolder,
    normalized.lakestatementpackage
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

report("statement import check", errors);
