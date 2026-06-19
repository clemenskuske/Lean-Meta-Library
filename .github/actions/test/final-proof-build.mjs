#!/usr/bin/env node
// Final import-stage check: build the proof package in an isolated copy and inspect compiled proof targets.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, relative, sep } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import { normalizeSubmissionRow, validateSubmissionRow } from "../submission-schema.mjs";
import { loadContext, slugToPascal } from "./general/manifest-context.mjs";
import {
  maxBuildOutputBytes,
  report,
  walkFiles
} from "./common.mjs";

const context = loadContext();
const errors = [];
const warnings = [];
const submissionRecords = loadSubmissionRecords(context.packageRoot);
const tmpRoot = mkdtempSync(join(tmpdir(), "lml-final-proof-build-"));
const isolatedPackageRoot = join(tmpRoot, "package");
const isolatedStatementRoot = context.manifest.statementRoot
  ? join(isolatedPackageRoot, context.manifest.statementRoot)
  : null;
const keepTemp = process.env.LML_KEEP_FINAL_PROOF_BUILD_TMP === "1";
const configuredAllowedMathlibAxioms = (lmlEnv.checks?.allowedMathlibAxioms ?? []).map(String);
const allowedMathlibAxioms = configuredAllowedMathlibAxioms.filter(isLeanName);
const invalidAllowedMathlibAxioms = configuredAllowedMathlibAxioms.filter((name) => !isLeanName(name));

try {
  copyPackage(context.packageRoot, isolatedPackageRoot);

  if (spawnSync("lake", ["--version"], { encoding: "utf8" }).error) {
    errors.push("lake executable not found on PATH");
  } else if (invalidAllowedMathlibAxioms.length > 0) {
    errors.push(`lml-env.json checks.allowedMathlibAxioms contains invalid Lean names: ${invalidAllowedMathlibAxioms.join(", ")}`);
  } else if (allowedMathlibAxioms.length === 0) {
    errors.push("lml-env.json checks.allowedMathlibAxioms must list at least one Lean axiom name");
  } else {
    const compositionPlan = proofCompositionPlan();
    augmentFinalProofLakefile(compositionPlan.requiredPackages);
    if (errors.length === 0) {
      runLake(["update"], "lake update");
      runLake(["clean"], "lake clean");
      fetchBuildCache();
      runLake(["build"], "lake build");
      buildImportedProofDependencies(compositionPlan.requiredProofPackages);
      if (errors.length === 0) {
        checkCompiledAxioms(compositionPlan);
      }
    }
  }
} finally {
  if (keepTemp) {
    warnings.push(`kept isolated final proof build tree at ${isolatedPackageRoot}`);
  } else {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

report("final proof build", errors, warnings);

function copyPackage(from, to) {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => {
      const name = basename(source);
      return name !== ".git" && name !== ".lake" && name !== "node_modules";
    }
  });
}

function runLake(args, label) {
  const result = spawnSync("lake", args, {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    env: lakeEnv(),
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    errors.push(`${label} failed to start: ${result.error.message}`);
    return result;
  }

  if (result.status !== 0) {
    errors.push(`${label} failed\n${result.stdout}${result.stderr}`.trim());
  }

  return result;
}

function fetchBuildCache() {
  const cacheArgs = finalProofCacheArgs();
  if (cacheArgs.length === 0) {
    warnings.push("no proof library target found for final proof build cache fetch");
    return;
  }
  const result = spawnSync("lake", ["exe", "cache", "get", ...cacheArgs], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    env: lakeEnv(),
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    warnings.push(`lake exe cache get failed to start; final proof build will build from source: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    warnings.push("lake exe cache get failed; final proof build will build from source");
  }
}

function lakeEnv() {
  return { ...process.env, MATHLIB_NO_CACHE_ON_UPDATE: "1" };
}

function finalProofCacheArgs() {
  const importedMathlibModules = mathlibImportModules(isolatedPackageRoot);
  if (importedMathlibModules.length > 0) {
    return importedMathlibModules;
  }
  const proofLib = context.namespaceRoot ? `${context.namespaceRoot}.Proofs` : null;
  return proofLib ? [proofLib] : [];
}

function mathlibImportModules(root) {
  const modules = new Set();
  for (const file of walkFiles(root)) {
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

function checkCompiledAxioms(compositionPlan) {
  const compositionTargets = compositionPlan.compositionTargets;
  const allowedConjectures = compositionPlan.allowedConjectures;
  if (compositionTargets.length === 0) {
    warnings.push("no proof targets were found for final axiom inspection");
    return;
  }

  const modules = builtModuleNames();
  const composedModuleName = "LmlComposed";
  const composedSource = join(isolatedPackageRoot, `${composedModuleName}.lean`);
  writeFileSync(
    composedSource,
    finalProofBuildComposer({ modules, compositionTargets, allowedMathlibAxioms, allowedConjectures }),
    "utf8"
  );

  const mergedLeanPath = join(tmpRoot, "merged-lean");
  mergeCurrentSubmissionBuilds(mergedLeanPath);
  const composedOlean = join(mergedLeanPath, `${composedModuleName}.olean`);
  mkdirSync(dirname(composedOlean), { recursive: true });
  const leanPath = finalProofLeanPath(mergedLeanPath);
  const leanEnv = leanPath ? { ...process.env, LEAN_PATH: leanPath } : process.env;

  const composeResult = spawnSync("lean", ["-o", composedOlean, composedSource], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    env: leanEnv,
    maxBuffer: maxBuildOutputBytes
  });

  if (composeResult.error) {
    errors.push(`could not compile composed proof module: ${composeResult.error.message}`);
    return;
  }
  if (composeResult.status !== 0) {
    errors.push(`final proof composition failed\n${composeResult.stdout}${composeResult.stderr}`.trim());
    return;
  }

  runLean4Checker(composedOlean);
  if (errors.length > 0) {
    return;
  }

  const verifier = join(isolatedPackageRoot, "FinalProofBuildVerify.lean");
  writeFileSync(
    verifier,
    finalProofBuildVerifier({ composedModuleName, compositionTargets, allowedMathlibAxioms, allowedConjectures }),
    "utf8"
  );

  const verifyResult = spawnSync("lean", [verifier], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    env: leanEnv,
    maxBuffer: maxBuildOutputBytes
  });

  if (verifyResult.error) {
    errors.push(`could not run final composed axiom verifier: ${verifyResult.error.message}`);
    return;
  }
  if (verifyResult.status !== 0) {
    errors.push(`final composed proof build has forbidden axioms\n${verifyResult.stdout}${verifyResult.stderr}`.trim());
  }
}

function proofCompositionPlan() {
  const currentEntries = currentProofEntries();
  const currentProofByStatement = mapProofsByStatement(currentEntries);
  const registry = registryProofIndex();
  const proofByStatement = new Map([...registry.proofByStatement, ...currentProofByStatement]);
  const knownStatements = knownStatementIndex();
  const compositionTargets = [];
  const queuedComposed = new Set();
  const includedStatements = new Set();
  const queue = [];

  for (const entry of currentEntries) {
    enqueueCompositionTarget(entry);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    for (const dep of entry.deps) {
      const depEntry = proofByStatement.get(dep);
      if (!depEntry || includedStatements.has(depEntry.statement)) {
        continue;
      }
      enqueueCompositionTarget(depEntry);
    }
  }

  const allowedConjectures = unresolvedConjectureAxiomNames({
    compositionTargets,
    knownStatements,
    proofByStatement
  });
  const requiredStatementPackages = requiredCurrentStatementPackages(currentEntries, registry.submissionsByPackage);
  const requiredProofPackages = requiredRegistryProofPackages(compositionTargets);
  const requiredPackages = uniquePackages([...requiredStatementPackages, ...requiredProofPackages]);

  return { compositionTargets, allowedConjectures, requiredPackages, requiredProofPackages };

  function enqueueCompositionTarget(entry) {
    if (queuedComposed.has(entry.composed)) {
      return;
    }
    queuedComposed.add(entry.composed);
    includedStatements.add(entry.statement);
    compositionTargets.push(entry);
    queue.push(entry);
  }
}

function currentProofEntries() {
  return (context.manifest.proofs ?? [])
    .map((proof) => proofEntry({
      statement: proof?.axiom,
      proof: proof?.proof,
      deps: proof?.deps,
      source: "current"
    }))
    .filter(Boolean);
}

function registryProofIndex() {
  const proofEntries = [];
  const submissionsByPackage = new Map();

  for (const record of submissionRecords) {
    const submission = submissionFromRecord(record);
    if (!submission) {
      continue;
    }
    submissionsByPackage.set(submission.statementPackage, submission);
    submissionsByPackage.set(submission.proofPackage, submission);

    for (const proof of record.proofs) {
      const entry = proofEntry({
        statement: proof?.AxiomReference ?? proof?.axiom,
        proof: proof?.Name ?? proof?.proof,
        deps: proof?.ProofObligations ?? proof?.deps,
        source: "registry",
        submission
      });
      if (entry) {
        proofEntries.push(entry);
      }
    }
  }

  return {
    proofByStatement: mapProofsByStatement(proofEntries),
    submissionsByPackage
  };
}

function knownStatementIndex() {
  const statements = new Map();
  for (const statement of currentStatementEntries()) {
    addKnownStatement(statements, statement, "current manifest");
  }
  for (const record of submissionRecords) {
    for (const statement of record.statements) {
      addKnownStatement(statements, statement, "submissions.jsonl");
    }
  }
  return statements;
}

function currentStatementEntries() {
  return (context.manifest.statements ?? []).map((entry) => ({
    Name: entry?.Statement?.Name ?? entry?.Name ?? entry?.name,
    Type: entry?.Type ?? entry?.type
  }));
}

function addKnownStatement(statements, statement, source) {
  const name = statement?.Name ?? statement?.name;
  if (!isLeanName(name)) {
    return;
  }
  const type = statement?.Type ?? statement?.type ?? "";
  if (statements.has(name) && statements.get(name).type !== type) {
    warnings.push(`statement ${name} has conflicting ${source} types; using the first imported type`);
    return;
  }
  if (!statements.has(name)) {
    statements.set(name, { name, type, source });
  }
}

function proofEntry({ statement, proof, deps, source, submission = null }) {
  if (!isLeanName(statement) || !isLeanName(proof)) {
    return null;
  }
  const composed = composedNameForProof(proof);
  if (!isLeanName(composed)) {
    return null;
  }
  return {
    statement,
    proof,
    composed,
    deps: Array.isArray(deps) ? deps.filter(isLeanName) : [],
    source,
    submission
  };
}

function mapProofsByStatement(entries) {
  const byStatement = new Map();
  for (const entry of entries) {
    if (byStatement.has(entry.statement)) {
      continue;
    }
    byStatement.set(entry.statement, entry);
  }
  return byStatement;
}

function unresolvedConjectureAxiomNames({ compositionTargets, knownStatements, proofByStatement }) {
  const composedStatements = new Set(compositionTargets.map((entry) => entry.statement));
  const conjectures = new Set();
  for (const entry of compositionTargets) {
    for (const dep of entry.deps) {
      if (composedStatements.has(dep) || proofByStatement.has(dep)) {
        continue;
      }
      const statement = knownStatements.get(dep);
      if (statement?.type === "Axiom") {
        conjectures.add(dep);
        continue;
      }
      if (!statement) {
        errors.push(`proof obligation ${dep} is not a composed proof target and is not a known unproved submission axiom`);
      }
    }
  }
  return [...conjectures].filter(isLeanName).sort();
}

function requiredCurrentStatementPackages(currentEntries, submissionsByPackage) {
  const namespaceRoot = context.namespaceRoot;
  const packages = new Map();
  for (const entry of currentEntries) {
    for (const name of [entry.statement, ...entry.deps]) {
      const packageName = statementPackageForName(name, namespaceRoot);
      if (!packageName || packages.has(packageName)) {
        continue;
      }
      const submission = submissionsByPackage.get(packageName);
      if (!submission) {
        errors.push(`cannot add final proof statement dependency ${packageName}: no matching submissions.jsonl row`);
        continue;
      }
      packages.set(packageName, {
        name: packageName,
        kind: "statement",
        submission,
        folder: submission.statementFolder
      });
    }
  }
  return [...packages.values()];
}

function requiredRegistryProofPackages(compositionTargets) {
  const packages = new Map();
  for (const entry of compositionTargets) {
    if (entry.source !== "registry" || !entry.submission?.proofPackage) {
      continue;
    }
    if (entry.submission.proofPackage === currentProofPackageName()) {
      continue;
    }
    packages.set(entry.submission.proofPackage, {
      name: entry.submission.proofPackage,
      kind: "proof",
      submission: entry.submission,
      folder: entry.submission.proofFolder
    });
  }
  return [...packages.values()];
}

function uniquePackages(packages) {
  const byName = new Map();
  for (const pkg of packages) {
    if (pkg?.name && !byName.has(pkg.name)) {
      byName.set(pkg.name, pkg);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function statementPackageForName(name, namespaceRoot) {
  if (!isLeanName(name)) {
    return null;
  }
  const submissionNamespace = name.split(".")[0];
  if (!submissionNamespace || submissionNamespace === namespaceRoot) {
    return null;
  }
  return `${submissionNamespace}.Statements`;
}

function currentProofPackageName() {
  return context.namespaceRoot ? `${context.namespaceRoot}.Proofs` : null;
}

function submissionFromRecord(record) {
  const slug = record.submissionSlug;
  const namespace = slug ? slugToPascal(slug) : null;
  if (!namespace) {
    return null;
  }
  return {
    namespace,
    statementPackage: `${namespace}.Statements`,
    proofPackage: `${namespace}.Proofs`,
    repoUrl: record.repoUrl,
    sourceBranch: record.sourceBranch,
    sourceCommit: record.sourceCommit,
    statementFolder: packageSubDir(record.statementFolder),
    proofFolder: packageSubDir(record.proofFolder)
  };
}

function augmentFinalProofLakefile(packages) {
  if (packages.length === 0) {
    return;
  }

  const lakefile = join(isolatedPackageRoot, "lakefile.lean");
  if (!existsSync(lakefile)) {
    errors.push("cannot add final proof dependencies: proof lakefile not found");
    return;
  }

  const source = readFileSync(lakefile, "utf8");
  const existing = existingRequireNames(source);
  const additions = [];

  for (const pkg of packages) {
    if (existing.has(pkg.name)) {
      continue;
    }
    const require = requireBlock(pkg);
    if (!require) {
      continue;
    }
    additions.push(require);
    existing.add(pkg.name);
  }

  if (additions.length === 0) {
    return;
  }

  writeFileSync(lakefile, insertRequireBlocks(source, additions), "utf8");
  warnings.push(`added final proof dependencies: ${additions.map((item) => item.name).join(", ")}`);
}

function buildImportedProofDependencies(requiredProofPackages) {
  if (requiredProofPackages.length === 0 || errors.length > 0) {
    return;
  }
  runLake(["build", ...requiredProofPackages.map((pkg) => pkg.name)], "lake build imported proof dependencies");
}

function requireBlock(pkg) {
  const submission = pkg.submission;
  const ref = submission.sourceCommit || submission.sourceBranch;
  if (!submission.repoUrl || !ref) {
    errors.push(`cannot add final proof dependency ${pkg.name}: submissions.jsonl row is missing Repo or Commit`);
    return null;
  }
  const subDir = pkg.folder ? ` / ${JSON.stringify(pkg.folder)}` : "";
  return {
    name: pkg.name,
    text: `require ${pkg.name} from git\n  ${JSON.stringify(submission.repoUrl)} @ ${JSON.stringify(ref)}${subDir}`
  };
}

function existingRequireNames(source) {
  const names = new Set();
  const requirePattern = /^\s*require\s+([A-Za-z_][A-Za-z0-9_'.]*)\b/gm;
  for (const match of source.matchAll(requirePattern)) {
    names.add(match[1]);
  }
  return names;
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

function trimTrailingNewline(value) {
  return String(value ?? "").replace(/\n+$/, "");
}

function loadSubmissionRecords(packageRoot) {
  const path = findSubmissionsJsonl(packageRoot);
  if (!path || !existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseSubmissionRecord(line, path, index + 1))
    .filter(Boolean);
}

function parseSubmissionRecord(line, path, lineNumber) {
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

  return normalizeSubmissionRow(row);
}

function findSubmissionsJsonl(packageRoot) {
  let dir = packageRoot;
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

function packageSubDir(path) {
  const normalized = String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
  return normalized === "." ? "" : normalized;
}

function composedNameForProof(proofName) {
  return isLeanName(proofName) ? `${proofName}._lml_composed` : null;
}

function builtModuleNames() {
  const names = new Set(lakeEmittedModuleNames());
  for (const { root, dependency } of buildLibraryRoots()) {
    for (const file of walkFiles(root, { ignoreDirs: new Set() })) {
      if (!file.endsWith(".olean")) {
        continue;
      }
      const moduleName = relativePath(root, file).replace(/\.olean$/i, "").split("/").join(".");
      if (
        isLeanName(moduleName) &&
        !isIgnoredModule(moduleName) &&
        !(dependency && isIgnoredDependencyModule(moduleName))
      ) {
        names.add(moduleName);
      }
    }
  }
  return [...names].sort();
}

function lakeEmittedModuleNames() {
  const outFile = join(isolatedPackageRoot, ".lake-build-mapping.json");
  const result = spawnSync("lake", ["build", "-o", outFile], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });
  if (result.error || result.status !== 0 || !existsSync(outFile)) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    return [];
  }

  const artifactPaths = [];
  collectStrings(parsed, artifactPaths);
  return [...new Set(
    artifactPaths
      .filter((value) => value.endsWith(".olean"))
      .map((value) => moduleNameFromOleanPath(value))
      .filter(isLeanName)
      .filter((moduleName) => !isIgnoredModule(moduleName))
  )].sort();
}

function collectStrings(value, out) {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, out);
    }
  }
}

function moduleNameFromOleanPath(path) {
  const normalized = String(path ?? "").split(sep).join("/");
  const marker = "/lib/lean/";
  const index = normalized.lastIndexOf(marker);
  const rel = index >= 0 ? normalized.slice(index + marker.length) : normalized;
  return rel.replace(/\.olean$/i, "").split("/").join(".");
}

function buildLibraryRoots() {
  const roots = [];
  const rootBuild = join(isolatedPackageRoot, ".lake/build/lib/lean");
  if (existsSync(rootBuild)) {
    roots.push({ root: rootBuild, dependency: false });
  }

  const packagesRoot = join(isolatedPackageRoot, ".lake/packages");
  if (existsSync(packagesRoot)) {
    for (const packageRoot of walkDirs(packagesRoot)) {
      roots.push(...dependencyBuildRoots(packageRoot));
    }
  }

  return roots;
}

function dependencyBuildRoots(packageRoot) {
  const roots = [];

  function visit(dir, depth) {
    const buildRoot = join(dir, ".lake/build/lib/lean");
    if (existsSync(buildRoot)) {
      roots.push({ root: buildRoot, dependency: true });
      return;
    }
    if (depth >= 3) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || [".git", ".lake", "node_modules"].includes(entry.name)) {
        continue;
      }
      visit(join(dir, entry.name), depth + 1);
    }
  }

  visit(packageRoot, 0);
  return roots;
}

function finalProofLeanPath(mergedLeanPath) {
  const result = spawnSync("lake", ["env", "printenv", "LEAN_PATH"], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });
  if (result.error || result.status !== 0) {
    return null;
  }

  const proofBuildPath = join(isolatedPackageRoot, ".lake", "build", "lib", "lean");
  const statementBuildPath = isolatedStatementRoot
    ? join(isolatedStatementRoot, ".lake", "build", "lib", "lean")
    : null;
  const entries = result.stdout.trim().split(delimiter).filter(Boolean);
  const externalEntries = entries.filter((entry) => entry !== proofBuildPath && entry !== statementBuildPath);
  return unique([mergedLeanPath, ...externalEntries]).join(delimiter);
}

function mergeCurrentSubmissionBuilds(targetRoot) {
  mkdirSync(targetRoot, { recursive: true });
  if (isolatedStatementRoot) {
    linkTree(join(isolatedStatementRoot, ".lake", "build", "lib", "lean"), targetRoot);
  }
  linkTree(join(isolatedPackageRoot, ".lake", "build", "lib", "lean"), targetRoot);
}

function linkTree(sourceRoot, targetRoot) {
  if (!existsSync(sourceRoot)) {
    return;
  }
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const source = join(sourceRoot, entry.name);
    const target = join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(target, { recursive: true });
      linkTree(source, target);
      continue;
    }
    if (entry.isFile() && !existsSync(target)) {
      symlinkSync(source, target);
    }
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function walkDirs(root) {
  const dirs = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.push(join(root, entry.name));
    }
  }
  return dirs;
}

function isIgnoredModule(moduleName) {
  return [
    "Aesop",
    "Batteries",
    "Cli",
    "ImportGraph",
    "Init",
    "Lake",
    "Lean",
    "LeanSearchClient",
    "Mathlib",
    "Plausible",
    "ProofWidgets",
    "Qq",
    "Std"
  ].some((prefix) => moduleName === prefix || moduleName.startsWith(`${prefix}.`));
}

function isIgnoredDependencyModule(moduleName) {
  return moduleName === "Cache" || moduleName.startsWith("Cache.");
}

function runLean4Checker(composedOlean) {
  const result = spawnSync("lake", ["env", "lean4checker", composedOlean], {
    cwd: isolatedPackageRoot,
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });

  if (result.error) {
    warnings.push(`lean4checker could not start; composed olean was not independently rechecked: ${result.error.message}`);
    return;
  }
  if (result.status === 255 && /could not execute external process 'lean4checker'/.test(`${result.stdout}${result.stderr}`)) {
    warnings.push("lean4checker not found; composed olean was not independently rechecked");
    return;
  }
  if (result.status !== 0) {
    errors.push(`lean4checker rejected composed olean\n${result.stdout}${result.stderr}`.trim());
  }
}

function finalProofBuildComposer({ modules, compositionTargets, allowedMathlibAxioms, allowedConjectures }) {
  const imports = modules.map((moduleName) => `import ${moduleName}`).join("\n");
  return `import Lean
import Lean.Util.CollectAxioms
${imports}

open Lean Meta Elab Command

namespace LmlFinalProofBuildComposer

structure AllowedAxiom where
  actual : Name
  expected : Name

def allowedBaseAxioms : Array AllowedAxiom := ${leanAllowedAxiomArray(allowedMathlibAxioms)}
def allowedConjectureAxioms : Array AllowedAxiom := ${leanAllowedAxiomArray(allowedConjectures)}

structure ProofEntry where
  statement : Name
  proof : Name
  composed : Name
  deps : Array Name

def proofEntries : Array ProofEntry := ${leanProofEntryArray(compositionTargets)}

def sameAxiomType (candidate allowed : ConstantInfo) : CoreM Bool := do
  if candidate.levelParams.length != allowed.levelParams.length then
    return false
  let levels := (List.range candidate.levelParams.length).map (fun index => Level.param (Name.mkSimple s!"u{index}"))
  let candidateType := candidate.type.instantiateLevelParams candidate.levelParams levels
  let allowedType := allowed.type.instantiateLevelParams allowed.levelParams levels
  Meta.MetaM.run' do
    Meta.isExprDefEq candidateType allowedType

def isAllowedAxiomName (allowed : Array AllowedAxiom) (name : Name) : Bool :=
  allowed.any (fun item => item.actual == name)

def isAllowedAxiomByNameAndType (allowed : Array AllowedAxiom) (name : Name) : CoreM Bool := do
  let info <- getConstInfo name
  match info with
  | .axiomInfo _ =>
      for allowedAxiom in allowed do
        if name == allowedAxiom.actual then
          let allowedInfo <- getConstInfo allowedAxiom.expected
          if (← sameAxiomType info allowedInfo) then
            return true
      return false
  | _ => return false

def isAllowedBaseAxiomByNameAndType (name : Name) : CoreM Bool :=
  isAllowedAxiomByNameAndType allowedBaseAxioms name

def isAllowedConjectureAxiom (name : Name) : CoreM Bool := do
  if !(isAllowedAxiomName allowedConjectureAxioms name) then
    return false
  isAllowedAxiomByNameAndType allowedConjectureAxioms name

def findProofEntry? (statement : Name) : Option ProofEntry :=
  proofEntries.find? (fun entry => entry.statement == statement)

def constValue? : ConstantInfo -> Option Expr
  | .thmInfo value => some value.value
  | .defnInfo value => some value.value
  | _ => none

def remapProofTerm (sigma : Array (Name × Name)) (expr : Expr) : Expr :=
  expr.replace fun
    | .const name levels =>
        match sigma.find? (fun pair => pair.fst == name) with
        | some pair => some (.const pair.snd levels)
        | none => none
    | _ => none

partial def visitEntry (entry : ProofEntry) (visiting visited : Array Name) (order : Array ProofEntry) :
    CoreM (Array Name × Array ProofEntry) := do
  if visited.contains entry.composed then
    return (visited, order)
  if visiting.contains entry.composed then
    IO.eprintln s!"STATEMENT_CYCLE\\t{entry.statement}"
    throwError "statement dependency graph contains a cycle"
  let visiting := visiting.push entry.composed
  let mut currentVisited := visited
  let mut currentOrder := order
  for dep in entry.deps do
    match findProofEntry? dep with
    | some depEntry =>
        let (nextVisited, nextOrder) <- visitEntry depEntry visiting currentVisited currentOrder
        currentVisited := nextVisited
        currentOrder := nextOrder
    | none => pure ()
  currentVisited := currentVisited.push entry.composed
  currentOrder := currentOrder.push entry
  return (currentVisited, currentOrder)

def topologicalProofEntries : CoreM (Array ProofEntry) := do
  let mut visited := #[]
  let mut order := #[]
  for entry in proofEntries do
    let (nextVisited, nextOrder) <- visitEntry entry #[] visited order
    visited := nextVisited
    order := nextOrder
  return order

def composeOne (sigma : Array (Name × Name)) (entry : ProofEntry) : MetaM Unit := do
  let env <- getEnv
  let some statementInfo := env.find? entry.statement
    | throwError "missing statement axiom {entry.statement}"
  match statementInfo with
  | .axiomInfo _ => pure ()
  | _ => throwError "statement target is not an axiom: {entry.statement}"
  let some proofInfo := env.find? entry.proof
    | throwError "missing proof theorem {entry.proof}"
  let some proofValue := constValue? proofInfo
    | throwError "proof target has no body: {entry.proof}"
  if statementInfo.levelParams.length != proofInfo.levelParams.length then
    throwError "level parameter mismatch between {entry.statement} and {entry.proof}"
  let levels := statementInfo.levelParams.map Level.param
  let value := proofValue.instantiateLevelParams proofInfo.levelParams levels
  let value := remapProofTerm sigma value
  addDecl <| .thmDecl {
    name := entry.composed
    levelParams := statementInfo.levelParams
    type := statementInfo.type
    value := value
  }

def declaredRemap (entry : ProofEntry) (composed : Array (Name × Name)) : Array (Name × Name) :=
  entry.deps.filterMap fun dep =>
    composed.find? (fun pair => pair.fst == dep)

def isAllowedDeclaredAxiom (entry : ProofEntry) (axiomName : Name) : CoreM Bool := do
  if (← isAllowedBaseAxiomByNameAndType axiomName) then
    return true
  if (← isAllowedConjectureAxiom axiomName) then
    return entry.deps.contains axiomName
  if (findProofEntry? axiomName).isSome then
    return entry.deps.contains axiomName
  return false

def checkDeclaredAxiomCoverage (entry : ProofEntry) : CoreM Bool := do
  let mut failed := false
  let axioms <- collectAxioms entry.proof
  for axiomName in axioms do
    if !(← isAllowedDeclaredAxiom entry axiomName) then
      IO.eprintln s!"UNDECLARED_AXIOM\\t{entry.proof}\\t{axiomName}"
      failed := true
  return failed

def checkAxiom (label : String) (owner : Name) (axiomName : Name) : CoreM Bool := do
  if (← isAllowedConjectureAxiom axiomName) then
    return false
  if (← isAllowedBaseAxiomByNameAndType axiomName) then
    return false
  let axiomInfo <- getConstInfo axiomName
  let typeText <- Meta.MetaM.run' do
    Meta.ppExpr axiomInfo.type
  IO.eprintln s!"FORBIDDEN_AXIOM\\t{label}\\t{owner}\\t{axiomName}\\t{typeText}"
  return true

elab "#lml_compose_proofs" : command => do
  liftCoreM do
    let mut failed := false
    let order <- topologicalProofEntries
    let mut composed : Array (Name × Name) := #[]

    for entry in order do
      if (← checkDeclaredAxiomCoverage entry) then
        failed := true
      try
        let sigma := declaredRemap entry composed
        Meta.MetaM.run' do
          composeOne sigma entry
        composed := composed.push (entry.statement, entry.composed)
      catch error =>
        let message <- error.toMessageData.toString
        IO.eprintln s!"COMPOSE_FAILED\\t{entry.statement}\\t{entry.proof}\\t{message}"
        failed := true

    if failed then
      throwError "final proof build has failed proof composition, forbidden axioms, or missing proof targets"

#lml_compose_proofs

end LmlFinalProofBuildComposer
`;
}

function finalProofBuildVerifier({ composedModuleName, compositionTargets, allowedMathlibAxioms, allowedConjectures }) {
  return `import Lean
import Lean.Util.CollectAxioms
import ${composedModuleName}

open Lean Meta

namespace LmlFinalProofBuildVerifier

structure AllowedAxiom where
  actual : Name
  expected : Name

def allowedBaseAxioms : Array AllowedAxiom := ${leanAllowedAxiomArray(allowedMathlibAxioms)}
def allowedConjectureAxioms : Array AllowedAxiom := ${leanAllowedAxiomArray(allowedConjectures)}
def composedTargets : Array Name := ${leanNameArray(compositionTargets.map((entry) => entry.composed))}

def sameAxiomType (candidate allowed : ConstantInfo) : CoreM Bool := do
  if candidate.levelParams.length != allowed.levelParams.length then
    return false
  let levels := (List.range candidate.levelParams.length).map (fun index => Level.param (Name.mkSimple s!"u{index}"))
  let candidateType := candidate.type.instantiateLevelParams candidate.levelParams levels
  let allowedType := allowed.type.instantiateLevelParams allowed.levelParams levels
  Meta.MetaM.run' do
    Meta.isExprDefEq candidateType allowedType

def isAllowedAxiomName (allowed : Array AllowedAxiom) (name : Name) : Bool :=
  allowed.any (fun item => item.actual == name)

def isAllowedAxiomByNameAndType (allowed : Array AllowedAxiom) (name : Name) : CoreM Bool := do
  let info <- getConstInfo name
  match info with
  | .axiomInfo _ =>
      for allowedAxiom in allowed do
        if name == allowedAxiom.actual then
          let allowedInfo <- getConstInfo allowedAxiom.expected
          if (← sameAxiomType info allowedInfo) then
            return true
      return false
  | _ => return false

def isAllowedBaseAxiomByNameAndType (name : Name) : CoreM Bool :=
  isAllowedAxiomByNameAndType allowedBaseAxioms name

def isAllowedConjectureAxiom (name : Name) : CoreM Bool := do
  if !(isAllowedAxiomName allowedConjectureAxioms name) then
    return false
  isAllowedAxiomByNameAndType allowedConjectureAxioms name

def checkAxiom (owner : Name) (axiomName : Name) : CoreM Bool := do
  if (← isAllowedConjectureAxiom axiomName) then
    return false
  if (← isAllowedBaseAxiomByNameAndType axiomName) then
    return false
  let axiomInfo <- getConstInfo axiomName
  let typeText <- Meta.MetaM.run' do
    Meta.ppExpr axiomInfo.type
  IO.eprintln s!"FORBIDDEN_AXIOM\\tcomposed\\t{owner}\\t{axiomName}\\t{typeText}"
  return true

#eval show CoreM Unit from do
  let mut failed := false
  for composedName in composedTargets do
    try
      let axioms <- collectAxioms composedName
      for axiomName in axioms do
        if (← checkAxiom composedName axiomName) then
          failed := true
    catch error =>
      let message <- error.toMessageData.toString
      IO.eprintln s!"COMPOSED_TARGET_NOT_FOUND\\t{composedName}\\t{message}"
      failed := true

  if failed then
    throwError "final composed proof build has forbidden axioms or missing composed targets"

end LmlFinalProofBuildVerifier
`;
}

function leanNameArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `\`${name}`).join(", ")}]`;
}

function leanAllowedAxiomArray(names) {
  return `#[${names.filter(isLeanName).map((name) => `{ actual := \`${name}, expected := \`${name} }`).join(", ")}]`;
}

function leanProofEntryArray(entries) {
  return `#[${entries.map((entry) => `{
  statement := \`${entry.statement},
  proof := \`${entry.proof},
  composed := \`${entry.composed},
  deps := ${leanNameArray(entry.deps)}
}`).join(", ")}]`;
}

function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(name ?? ""));
}

function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}
