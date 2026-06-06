#!/usr/bin/env node
// Uses Lean to verify that each metadata surface file introduces exactly one simple declaration.
// The check diffs the environment before and after importing the surface module, so hidden public, private, generated, or instance declarations are rejected.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadContext,
  maxBuildOutputBytes,
  readIfExists,
  report
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { inspectIntroducedDeclarations, isLeanName } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const surfaceRoot = join(packageRoot, "surface-package");
const surfaceLakeConfig = loadLakeConfig(surfaceRoot, "surface lakefile", errors);
const surfaceFiles = (meta.declarations ?? [])
  .map((entry) => join(packageRoot, entry.folder ?? "", "Surface.lean"))
  .filter(existsSync);
const importsByFile = parseLeanImports(surfaceFiles, errors);

for (const entry of meta.declarations ?? []) {
  checkSurfaceEntry(entry);
}

function checkSurfaceEntry(entry) {
  const surfacePath = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const source = readIfExists(surfacePath);
  const label = `${entry.folder ?? "(missing folder)"}/Surface.lean`;

  if (!source) {
    return;
  }

  const moduleName = lakeModuleForFile(surfaceLakeConfig, surfaceRoot, surfacePath);
  if (!moduleName) {
    errors.push(`Lake does not expose a buildable Lean module for ${label}`);
    return;
  }

  if (!isLeanModuleName(moduleName)) {
    errors.push(`surface file has invalid Lean module name ${moduleName}: ${label}`);
    return;
  }

  const build = spawnSync("lake", ["--dir", surfaceRoot, "build", moduleName], {
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
  if (outputReportsSorry(`${build.stdout ?? ""}${build.stderr ?? ""}`)) {
    errors.push(`surface file ${label} reports a sorry`);
  }

  const imports = ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== moduleName)];
  const declarations = inspectIntroducedDeclarations({ packageDir: surfaceRoot, moduleName, imports, label, errors });
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
  if (type === "Statement") {
    return kind === "axiom" || kind === "theorem";
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

function outputReportsSorry(output) {
  return /\bdeclaration uses ['"`]sorry['"`]/i.test(output) || /\bsorryAx\b/.test(output);
}

report("surface declarations", errors);
