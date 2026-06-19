// Adds statement-package dependencies needed by proof manifest before building proofs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { normalizeSubmissionRow, validateSubmissionRow } from "../../submission-schema.mjs";
import { proofPackageRoot } from "../common.mjs";
import { slugToPascal } from "../general/manifest-context.mjs";
import { lakeDependencies, loadLakeConfig } from "../lake-config.mjs";

export function augmentProofLakefile({ packageRoot, manifest, errors, warnings }) {
  const context = proofStatementDependencyContext({ packageRoot, manifest, errors, action: "augment" });
  if (!context) {
    return;
  }

  const { required, byPackage, source, absoluteLakefile, dependencyByName } = context;
  const existing = new Set(dependencyByName.keys());
  const additions = [];

  for (const packageName of required) {
    const submission = byPackage.get(packageName);
    if (!submission) {
      errors.push(`cannot add proof lakefile dependency ${packageName}: no matching submissions.jsonl row`);
      continue;
    }

    const dependency = dependencyByName.get(packageName);
    if (dependency) {
      validateProofStatementDependency({ dependency, submission, errors });
      continue;
    }

    additions.push(requireBlock(packageName, submission));
    existing.add(packageName);
  }

  if (additions.length === 0) {
    return;
  }

  writeFileSync(absoluteLakefile, insertRequireBlocks(source, additions), "utf8");
  warnings.push(`added proof lakefile statement dependencies: ${additions.map((item) => item.name).join(", ")}`);
}

export function validateProofLakefileStatementDependencies({ packageRoot, manifest, errors }) {
  const context = proofStatementDependencyContext({ packageRoot, manifest, errors, action: "validate" });
  if (!context) {
    return;
  }

  const { required, byPackage, dependencyByName } = context;
  for (const packageName of required) {
    const submission = byPackage.get(packageName);
    if (!submission) {
      errors.push(`proof lakefile statement dependency ${packageName} has no matching submissions.jsonl row`);
      continue;
    }

    const dependency = dependencyByName.get(packageName);
    if (dependency) {
      validateProofStatementDependency({ dependency, submission, errors });
    }
  }
}

function proofStatementDependencyContext({ packageRoot, manifest, errors, action }) {
  const pRoot = proofPackageRoot(manifest);
  if (!pRoot) {
    return null;
  }
  const lakefilePath = join(pRoot, "lakefile.lean");

  const required = referencedStatementPackages(manifest);
  if (required.length === 0) {
    return null;
  }

  const absoluteLakefile = resolve(packageRoot, lakefilePath);
  if (!existsSync(absoluteLakefile)) {
    return null;
  }
  if (extname(absoluteLakefile) !== ".lean") {
    errors.push(`cannot ${action} non-Lean proof lakefile: ${lakefilePath}`);
    return null;
  }

  const proofRoot = resolve(packageRoot, pRoot);
  const proofLakeConfig = loadLakeConfig(proofRoot, "proof lakefile", errors);
  const dependencyByName = new Map(lakeDependencies(proofLakeConfig).map((dependency) => [dependency.name, dependency]));
  const submissions = loadSubmissionRows({ packageRoot, errors });
  const byPackage = new Map(submissions.map((submission) => [submission.statementPackage, submission]));
  const source = readFileSync(absoluteLakefile, "utf8");

  return { required, byPackage, source, absoluteLakefile, dependencyByName };
}

function referencedStatementPackages(manifest) {
  const namespaceRoot = manifest.submissionSlug ? slugToPascal(manifest.submissionSlug) : null;
  const packages = new Set();

  for (const proof of manifest.proofs ?? []) {
    const statementPackage = statementPackageForAxiom(proof?.axiom, namespaceRoot);
    if (statementPackage) {
      packages.add(statementPackage);
    }
    for (const dep of Array.isArray(proof?.deps) ? proof.deps : []) {
      const dependencyPackage = statementPackageForAxiom(dep, namespaceRoot);
      if (dependencyPackage) {
        packages.add(dependencyPackage);
      }
    }
  }

  return [...packages].sort();
}

function statementPackageForAxiom(axiom, namespaceRoot) {
  if (typeof axiom !== "string" || axiom.length === 0) {
    return null;
  }
  const submissionNamespace = axiom.split(".")[0];
  if (!submissionNamespace || submissionNamespace === namespaceRoot) {
    return null;
  }
  return `${submissionNamespace}.Statements`;
}

function requireBlock(packageName, submission) {
  const ref = submission.sourceCommit || submission.sourceBranch;
  const subDir = submission.statementFolder ? ` / ${JSON.stringify(submission.statementFolder)}` : "";
  return {
    name: packageName,
    text: `require ${packageName} from git\n  ${JSON.stringify(submission.repoUrl)} @ ${JSON.stringify(ref)}${subDir}`
  };
}

function validateProofStatementDependency({ dependency, submission, errors }) {
  if (!dependencyMatchesSubmission(dependency, submission)) {
    errors.push(`proof lakefile dependency is not allowed by submissions.jsonl: ${formatDependency(dependency)}`);
  }
}

function dependencyMatchesSubmission(dependency, submission) {
  const expectedRef = submission.sourceCommit || submission.sourceBranch;
  return (
    dependency.kind === "git" &&
    normalizeGitUrl(dependency.url) === normalizeGitUrl(submission.repoUrl) &&
    dependency.ref === expectedRef &&
    (!dependency.subDir || normalizePath(dependency.subDir) === normalizePath(submission.statementFolder))
  );
}

function normalizeGitUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/$/g, "");
}

function formatDependency(dependency) {
  if (dependency.kind === "local") {
    return `${dependency.name} from ${dependency.path}`;
  }
  const subDir = dependency.subDir ? ` / "${dependency.subDir}"` : "";
  const ref = dependency.ref ? ` @ "${dependency.ref}"` : "";
  return `${dependency.name} from ${dependency.url}${ref}${subDir}`;
}

function insertRequireBlocks(source, additions) {
  const text = additions.map((item) => item.text).join("\n\n");
  const insertAt = source.search(/^\s*(?:lean_lib|@[^\n]*\n\s*lean_lib)\b/m);
  if (insertAt === -1) {
    return `${trimTrailingNewline(source)}\n\n${text}\n`;
  }

  const before = trimTrailingNewline(source.slice(0, insertAt));
  const after = source.slice(insertAt).replace(/^\n+/, "");
  return `${before}\n\n${text}\n\n${after}`;
}

function loadSubmissionRows({ packageRoot, errors }) {
  const path = findSubmissionsJsonl(packageRoot);
  if (!path || !existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseSubmissionRow(line, path, index + 1, errors))
    .filter(Boolean);
}

function parseSubmissionRow(line, path, lineNumber, errors) {
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

  const normalized = normalizeSubmissionRow(row);
  const slug = normalized.submissionSlug;
  const statementPackage = slug ? `${slugToPascal(slug)}.Statements` : null;
  const statementFolder = normalizePath(normalized.statementFolder);

  const submission = {
    statementPackage,
    repoUrl: normalized.repoUrl,
    sourceBranch: normalized.sourceBranch,
    sourceCommit: normalized.sourceCommit,
    statementFolder
  };

  for (const [key, value] of Object.entries({
    statementPackage: submission.statementPackage,
    repoUrl: submission.repoUrl,
    sourceCommit: submission.sourceCommit
  })) {
    if (!value) {
      errors.push(`${path}:${lineNumber} is missing ${key}`);
    }
  }

  return submission.statementPackage ? submission : null;
}

function findSubmissionsJsonl(packageRoot) {
  let dir = resolve(packageRoot);
  while (true) {
    const candidate = join(dir, "submissions.jsonl");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

function trimTrailingNewline(value) {
  return String(value ?? "").replace(/\n+$/, "");
}
