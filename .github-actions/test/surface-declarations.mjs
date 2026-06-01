#!/usr/bin/env node
// Uses Lean to verify that each metadata surface file introduces exactly one simple declaration.
// The check diffs the environment before and after importing the surface module, so hidden public, private, generated, or instance declarations are rejected.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  listImports,
  loadContext,
  maxBuildOutputBytes,
  readIfExists,
  relativePath,
  report,
  stripLeanCommentsAndStrings
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const surfaceRoot = join(packageRoot, "surface-package");

for (const entry of meta.surfaceEntries ?? []) {
  checkSurfaceEntry(entry);
}

function checkSurfaceEntry(entry) {
  const surfacePath = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const source = readIfExists(surfacePath);
  const label = `${entry.folder ?? "(missing folder)"}/Surface.lean`;

  if (!source) {
    return;
  }

  const moduleName = moduleNameForSurfacePath(surfacePath);
  if (!moduleName) {
    errors.push(`could not infer Lean module name for ${label}`);
    return;
  }

  if (!isLeanModuleName(moduleName)) {
    errors.push(`surface file has invalid Lean module name ${moduleName}: ${label}`);
    return;
  }

  const sourceIssues = staticDeclarationIssues(source, label);
  errors.push(...sourceIssues);

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

  const imports = ["Init", ...listImports(source).filter((imported) => imported !== moduleName)];
  const declarations = introducedDeclarations({ moduleName, imports, label });
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
  if (primary?.isInstance) {
    errors.push(`${label} declaration ${primary.name} is registered as a typeclass instance`);
  }

  const extras = declarations.filter((declaration) => declaration !== primary);
  for (const extra of extras) {
    errors.push(`${label} introduces extra declaration ${extra.name} (${describeDeclaration(extra)})`);
  }
}

function staticDeclarationIssues(source, label) {
  const stripped = stripLeanCommentsAndStrings(source);
  const issues = [];
  const forbidden = [
    ["abbrev", /\babbrev\b/],
    ["class", /\bclass\b/],
    ["inductive", /\binductive\b/],
    ["instance", /\binstance\b/],
    ["opaque", /\bopaque\b/],
    ["structure", /\bstructure\b/]
  ];

  for (const [name, pattern] of forbidden) {
    if (pattern.test(stripped)) {
      issues.push(`${label} uses ${name}, but surface files may only introduce one def, axiom, or theorem`);
    }
  }

  return issues;
}

function introducedDeclarations({ moduleName, imports, label }) {
  const tmp = mkdtempSync(join(tmpdir(), "lml-surface-decls-"));
  const inspector = join(tmp, "Inspect.lean");

  try {
    writeFileSync(inspector, inspectorSource({ moduleName, imports }));
    const result = spawnSync("lake", ["--dir", surfaceRoot, "env", "lean", inspector], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean declaration inspector for ${label}: ${result.error.message}`);
      return null;
    }
    if (result.status !== 0) {
      errors.push(`Lean declaration inspector failed for ${label}\n${result.stdout}${result.stderr}`.trim());
      return null;
    }

    return parseDeclarationOutput(result.stdout);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function inspectorSource({ moduleName, imports }) {
  const beforeImports = unique(imports).map(leanImportLiteral).join(", ");
  const afterImports = unique([...imports, moduleName]).map(leanImportLiteral).join(", ");

  return `import Lean
import Lean.Meta.Instances
open Lean

def kindOf : ConstantInfo -> String
  | .axiomInfo _ => "axiom"
  | .defnInfo _ => "definition"
  | .thmInfo _ => "theorem"
  | .opaqueInfo _ => "opaque"
  | .quotInfo _ => "quot"
  | .inductInfo _ => "inductive"
  | .ctorInfo _ => "constructor"
  | .recInfo _ => "recursor"

#eval show IO Unit from do
  let before <- importModules #[${beforeImports}] {}
  let after <- importModules #[${afterImports}] {}
  for (name, info) in after.constants.toList do
    if !before.constants.contains name then
      IO.println s!"DECL\\t{name}\\t{kindOf info}\\t{Lean.Meta.isInstanceCore after name}"
`;
}

function parseDeclarationOutput(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("DECL\t"))
    .map((line) => {
      const [, name, kind, isInstance] = line.split("\t");
      return { name, kind, isInstance: isInstance === "true" };
    });
}

function moduleNameForSurfacePath(surfacePath) {
  if (!existsSync(surfacePath)) {
    return null;
  }

  const rel = relative(surfaceRoot, surfacePath);
  if (rel.startsWith("..")) {
    return null;
  }

  return rel.replace(/\.lean$/i, "").split(/[\\/]/).join(".");
}

function isLeanModuleName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(name);
}

function leanImportLiteral(moduleName) {
  if (!isLeanModuleName(moduleName)) {
    errors.push(`invalid Lean import module name: ${moduleName}`);
    return "{module := `Init}";
  }
  return `{module := \`${moduleName}}`;
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
  if (type === "Theorem" || type === "Conjecture") {
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

report("surface declarations", errors);
