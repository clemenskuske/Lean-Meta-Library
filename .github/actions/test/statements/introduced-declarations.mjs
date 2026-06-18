#!/usr/bin/env node
// Uses Lean to verify that each manifest statement entry resolves to one simple declaration.
// The check diffs the environment before and after importing each module, so hidden
// public, private, generated, or instance declarations are rejected unless they
// are explicitly listed as submitted statements.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadContext } from "../general/manifest-context.mjs";
import {
  readIfExists,
  report,
  statementPackageRoot
} from "../common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "../lake-config.mjs";
import { inspectIntroducedDeclarations, isLeanName } from "../lean-inspect.mjs";
import { parseLeanImports } from "../lean-imports.mjs";
import { ensurePreparedLakePackage } from "../general/prepare-lake-package.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];
const warnings = [];
const statements = Array.isArray(manifest.statements) ? manifest.statements : [];
const stmtPkgRoot = statementPackageRoot(manifest);
const statementRoot = stmtPkgRoot ? resolve(packageRoot, stmtPkgRoot) : null;
ensurePreparedLakePackage({
  packageRoot,
  lakefilePath: stmtPkgRoot ? join(stmtPkgRoot, "lakefile.lean") : null,
  kind: "statement",
  label: "statement package",
  errors,
  warnings
});
const statementLakeConfig = statements.length > 0 && statementRoot && existsSync(join(statementRoot, "lakefile.lean"))
  ? loadLakeConfig(statementRoot, "statement lakefile", errors)
  : null;
const entriesByFile = statementEntriesByFile(statements);
const statementFiles = [...entriesByFile.keys()].map((file) => join(packageRoot, file)).filter(existsSync);
const importsByFile = parseLeanImports(statementFiles, errors);

for (const [leanFile, entries] of entriesByFile) {
  checkStatementFile(leanFile, entries);
}

function checkStatementFile(leanFile, entries) {
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

  const primaryDeclarations = new Set();
  const primaryEntryByDeclaration = new Map();
  for (const entry of entries) {
    const statementName = statementNameForEntry(entry);
    const directDeclarations = declarations.filter((declaration) => isPrimaryDeclarationForEntry(declaration.name, statementName));
    if (directDeclarations.length !== 1) {
      errors.push(
        `${label} should introduce exactly one direct declaration for ${statementName}, found ${formatCount(directDeclarations)}`
      );
      continue;
    }

    const primary = directDeclarations[0];
    const previousEntry = primaryEntryByDeclaration.get(primary.name);
    if (previousEntry) {
      errors.push(`${label} declaration ${primary.name} is matched by multiple statement entries: ${statementNameForEntry(previousEntry)}, ${statementName}`);
      continue;
    }

    primaryDeclarations.add(primary);
    primaryEntryByDeclaration.set(primary.name, entry);

    if (!allowedKindForEntry(entry.Type, primary.kind)) {
      errors.push(`${label} declaration ${primary.name} has kind ${primary.kind}, which is not allowed for ${entry.Type}`);
    }
    if (primary.isAbbrev) {
      errors.push(`${label} declaration ${primary.name} is an abbrev, which is not allowed for ${entry.Type}`);
    }
    if (primary.isUnsafe) {
      errors.push(`${label} declaration ${primary.name} is unsafe`);
    }
    if (primary.isInstance) {
      errors.push(`${label} declaration ${primary.name} is registered as a typeclass instance`);
    }
  }

  const extras = declarations.filter((declaration) => !primaryDeclarations.has(declaration));
  for (const extra of extras) {
    errors.push(`${label} introduces extra declaration ${extra.name} (${describeDeclaration(extra)})`);
  }
}

function statementEntriesByFile(entries) {
  const byFile = new Map();
  for (const entry of entries) {
    const leanFile = statementLeanFileForEntry(entry);
    if (!leanFile) {
      continue;
    }
    const existing = byFile.get(leanFile) ?? [];
    existing.push(entry);
    byFile.set(leanFile, existing);
  }
  return byFile;
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

function isPrimaryDeclarationForEntry(name, manifestName) {
  return name === manifestName || isDirectChildOf(name, manifestName);
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
