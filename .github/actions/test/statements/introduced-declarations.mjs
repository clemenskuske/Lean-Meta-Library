#!/usr/bin/env node
// Uses Lean to verify that each metadata statement file introduces exactly one simple declaration.
// The check diffs the environment before and after importing the module, so hidden public, private, generated, or instance declarations are rejected.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "../general/meta-context.mjs";
import {
  packageRootForLakefile,
  readIfExists,
  report,
  statementLakefilePath
} from "../common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "../lake-config.mjs";
import { inspectIntroducedDeclarations, isLeanName } from "../lean-inspect.mjs";
import { parseLeanImports } from "../lean-imports.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const warnings = [];
const statements = Array.isArray(meta.statements) ? meta.statements : [];
const statementRoot = statementLakefilePath(meta)
  ? packageRootForLakefile(packageRoot, statementLakefilePath(meta))
  : null;
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: statementLakefilePath(meta),
  kind: "statement",
  label: "statement package",
  errors,
  warnings
});
const statementLakeConfig = statements.length > 0 && statementRoot && existsSync(join(statementRoot, "lakefile.lean"))
  ? loadLakeConfig(statementRoot, "statement lakefile", errors)
  : null;
const statementFiles = statements
  .map((entry) => join(packageRoot, statementLeanFileForEntry(entry) ?? ""))
  .filter(existsSync);
const importsByFile = parseLeanImports(statementFiles, errors);

for (const entry of statements) {
  checkStatementEntry(entry);
}

function checkStatementEntry(entry) {
  const leanFile = statementLeanFileForEntry(entry);
  const statementPath = join(packageRoot, leanFile ?? "");
  const source = readIfExists(statementPath);
  const label = leanFile ?? "(missing statement file)";

  if (!source) {
    return;
  }

  if (!statementRoot || !statementLakeConfig) {
    errors.push(`statement lakefile is required to inspect statement file ${label}`);
    return;
  }

  const moduleName = lakeModuleForFile(statementLakeConfig, statementRoot, statementPath);
  if (!moduleName) {
    errors.push(`Lake does not expose a buildable Lean module for statement file ${label}`);
    return;
  }

  if (!isLeanModuleName(moduleName)) {
    errors.push(`statement file has invalid Lean module name ${moduleName}: ${label}`);
    return;
  }

  const imports = ["Init", ...(importsByFile.get(statementPath) ?? []).filter((imported) => imported !== moduleName)];
  const declarations = inspectIntroducedDeclarations({ packageDir: statementRoot, moduleName, imports, label, errors, build: false });
  if (!declarations) {
    return;
  }

  const statementName = statementNameForEntry(entry);
  const directDeclarations = declarations.filter((declaration) => isPrimaryDeclarationForEntry(declaration.name, statementName));
  if (directDeclarations.length !== 1) {
    errors.push(
      `${label} should introduce exactly one direct declaration under ${statementName}, found ${formatCount(directDeclarations)}`
    );
  }

  const primary = directDeclarations[0];
  if (primary && !allowedKindForEntry(entry.Type, primary.kind)) {
    errors.push(`${label} declaration ${primary.name} has kind ${primary.kind}, which is not allowed for ${entry.Type}`);
  }
  if (primary?.isAbbrev) {
    errors.push(`${label} declaration ${primary.name} is an abbrev, which is not allowed for ${entry.Type}`);
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

function statementLeanFileForEntry(entry) {
  return entry?.Statement?.LeanStatement ?? null;
}

function statementNameForEntry(entry) {
  return entry?.Statement?.Name ?? null;
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

function isPrimaryDeclarationForEntry(name, metadataName) {
  return name === metadataName || isDirectChildOf(name, metadataName);
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

report("statement declarations", errors, warnings);
