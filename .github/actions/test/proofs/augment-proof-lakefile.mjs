// Adds statement-package dependencies needed by proof manifest before building proofs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { normalizeSubmissionRow, validateSubmissionRow } from "../../submission-schema.mjs";
import { proofPackageRoot } from "../common.mjs";
import { slugToPascal } from "../general/manifest-context.mjs";

export function augmentProofLakefile({ packageRoot, manifest, errors, warnings }) {
  const pRoot = proofPackageRoot(manifest);
  if (!pRoot) {
    return;
  }
  const lakefilePath = join(pRoot, "lakefile.lean");

  const required = referencedStatementPackages(manifest);
  if (required.length === 0) {
    return;
  }

  const absoluteLakefile = resolve(packageRoot, lakefilePath);
  if (!existsSync(absoluteLakefile)) {
    return;
  }
  if (extname(absoluteLakefile) !== ".lean") {
    errors.push(`cannot augment non-Lean proof lakefile: ${lakefilePath}`);
    return;
  }

  const submissions = loadSubmissionRows({ packageRoot, errors });
  const byPackage = new Map(submissions.map((submission) => [submission.statementPackage, submission]));
  const source = readFileSync(absoluteLakefile, "utf8");
  const existing = existingRequireNames(source);
  const additions = [];

  for (const packageName of required) {
    if (existing.has(packageName)) {
      continue;
    }

    const submission = byPackage.get(packageName);
    if (!submission) {
      errors.push(`cannot add proof lakefile dependency ${packageName}: no matching submissions.jsonl row`);
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

function referencedStatementPackages(manifest) {
  const namespaceRoot = manifest.submissionSlug ? slugToPascal(manifest.submissionSlug) : null;
  const packages = new Set();

  for (const proof of manifest.proofs ?? []) {
    const statementPackage = statementPackageForAxiom(proof?.axiom, namespaceRoot);
    if (statementPackage) {
      packages.add(statementPackage);
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

function existingRequireNames(source) {
  const names = new Set();
  const requirePattern = /^\s*require\s+([A-Za-z_][A-Za-z0-9_'.]*)\b/gm;
  for (const match of source.matchAll(requirePattern)) {
    names.add(match[1]);
  }
  return names;
}

function requireBlock(packageName, submission) {
  const ref = submission.sourceCommit || submission.sourceBranch;
  const subDir = submission.statementFolder ? ` / ${JSON.stringify(submission.statementFolder)}` : "";
  return {
    name: packageName,
    text: `require ${packageName} from git\n  ${JSON.stringify(submission.repoUrl)} @ ${JSON.stringify(ref)}${subDir}`
  };
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
