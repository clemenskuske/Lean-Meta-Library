#!/usr/bin/env node
// Uses Lean to verify that each metadata statement/declaration file introduces exactly one simple declaration.
// The check diffs the environment before and after importing the module, so hidden public, private, generated, or instance declarations are rejected.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadContext,
  maxBuildOutputBytes,
  metadataStatements,
  packageRootForLakefile,
  readIfExists,
  report,
  statementLakefilePath,
  statementLeanFileForEntry
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { inspectIntroducedDeclarations, isLeanName } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const statements = metadataStatements(meta);
const statementRoot = statementLakefilePath(meta)
  ? packageRootForLakefile(packageRoot, statementLakefilePath(meta))
  : join(packageRoot, "surface-package");
const statementLakeConfig = statements.length > 0 && statementRoot && existsSync(join(statementRoot, "lakefile.lean"))
  ? loadLakeConfig(statementRoot, "statement/declaration lakefile", errors)
  : null;
const statementFiles = statements
  .map((entry) => join(packageRoot, statementLeanFileForEntry(entry) ?? ""))
  .filter(existsSync);
const importsByFile = parseLeanImports(statementFiles, errors);

for (const entry of statements) {
  checkSurfaceEntry(entry);
}

function checkSurfaceEntry(entry) {
  const leanFile = statementLeanFileForEntry(entry);
  const surfacePath = join(packageRoot, leanFile ?? "");
  const source = readIfExists(surfacePath);
  const label = leanFile ?? "(missing statement file)";

  if (!source) {
    return;
  }

  const moduleName = lakeModuleForFile(statementLakeConfig, statementRoot, surfacePath);
  if (!moduleName) {
    errors.push(`Lake does not expose a buildable Lean module for statement/declaration file ${label}`);
    return;
  }

  if (!isLeanModuleName(moduleName)) {
    errors.push(`statement/declaration file has invalid Lean module name ${moduleName}: ${label}`);
    return;
  }

  const build = spawnSync("lake", ["--dir", statementRoot, "build", moduleName], {
    encoding: "utf8",
    maxBuffer: maxBuildOutputBytes
  });
  if (build.error) {
    errors.push(`could not run lake build for ${label}: ${build.error.message}`);
    return;
  }
  if (build.status !== 0) {
    errors.push(`Lean failed to build ${label}\n${build.stdout}${build.stderr}`.trim());
    return;
  }

  const imports = ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== moduleName)];
  const declarations = inspectIntroducedDeclarations({ packageDir: statementRoot, moduleName, imports, label, errors });
  if (!declarations) {
    return;
  }

  const directDeclarations = declarations.filter((declaration) => isDirectChildOf(declaration.name, entry.name));
  if (directDeclarations.length !== 1) {
    errors.push(
      `${label} should introduce exactly one direct declaration under ${entry.name}, found ${formatCount(directDeclarations)}`
    );
  }

  const primary = directDeclarations[0];
  if (primary && !allowedKindForEntry(entry.type, primary.kind)) {
    errors.push(`${label} declaration ${primary.name} has kind ${primary.kind}, which is not allowed for ${entry.type}`);
  }
  if (primary?.isAbbrev) {
    errors.push(`${label} declaration ${primary.name} is an abbrev, which is not allowed for ${entry.type}`);
  }
  if (primary?.isUnsafe) {
    errors.push(`${label} declaration ${primary.name} is unsafe`);
  }
  if (primary?.isInstance) {
    errors.push(`${label} declaration ${primary.name} is registered as a typeclass instance`);
  }

  const extras = declarations.filter((declaration) => declaration !== primary);
  for (const extra of extras) {
    errors.push(`${label} introduces extra declaration ${extra.name} (${describeDeclaration(extra)})`);
  }
}

function isLeanModuleName(name) {
  return isLeanName(name);
}

function isDirectChildOf(name, namespace) {
  if (!namespace || !name.startsWith(`${namespace}.`)) {
    return false;
  }

  const suffix = name.slice(namespace.length + 1);
  return suffix.length > 0 && !suffix.includes(".");
}

function allowedKindForEntry(type, kind) {
  if (type === "Definition") {
    return kind === "definition";
  }
  if (type === "Axiom") {
    return kind === "axiom";
  }
  return false;
}

function describeDeclaration(declaration) {
  return declaration.isInstance ? `${declaration.kind}, instance` : declaration.kind;
}

function formatCount(items) {
  if (items.length === 0) {
    return "none";
  }
  return items.map((item) => `${item.name} (${describeDeclaration(item)})`).join(", ");
}

report("surface declarations", errors);
