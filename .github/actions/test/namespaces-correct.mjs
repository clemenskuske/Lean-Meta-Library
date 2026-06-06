#!/usr/bin/env node
// Checks that both lakefiles and all Lean files use the namespace shape implied by metadata.
// The metadata `namespaceSlug` is the source for `ChosenSlug.Surface...` and `ChosenSlug.Proofs...`.
import { join } from "node:path";
import {
  isLeanName,
  loadContext,
  proofNameForProofEntry,
  report,
  requireMeta
} from "./common.mjs";
import { hasLeanLib, lakeDependencies, lakeModuleForFile, loadLakeConfig, normalizePath } from "./lake-config.mjs";
import { inspectIntroducedDeclarations } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];
const proofLakeConfig = loadLakeConfig(packageRoot, "proof lakefile", errors);
const surfaceLakeConfig = loadLakeConfig(join(packageRoot, "surface-package"), "surface lakefile", errors);

requireMeta(context, errors);

if (!namespaceRoot) {
  errors.push("could not infer namespace root from metadata");
}

if (!meta.namespaceSlug) {
  errors.push("metadata must define namespaceSlug for namespace checks");
}

checkProofLakefile(proofLakeConfig);
checkSurfaceLakefile(surfaceLakeConfig);

for (const entry of meta.declarations ?? []) {
  const expectedPrefix = `${namespaceRoot}.Surface.${entry.type}.`;
  if (!entry.name?.startsWith(expectedPrefix)) {
    errors.push(`declaration namespace should start with ${expectedPrefix}: ${entry.name}`);
  }

  const surfacePath = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const moduleName = lakeModuleForFile(surfaceLakeConfig, join(packageRoot, "surface-package"), surfacePath);
  if (!moduleName) {
    errors.push(`could not infer surface module for ${entry.folder ?? "(missing folder)"}/Surface.lean`);
    continue;
  }

  const importsByFile = parseLeanImports([surfacePath], errors);
  const declarations = inspectIntroducedDeclarations({
    packageDir: join(packageRoot, "surface-package"),
    moduleName,
    imports: ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== moduleName)],
    label: `${entry.folder ?? "(missing folder)"}/Surface.lean`,
    errors
  }) ?? [];
  if (!declarations.some((declaration) => isDirectChildOf(declaration.name, entry.name))) {
    errors.push(`surface file ${entry.folder}/Surface.lean does not declare a direct child of ${entry.name}`);
  }
}

for (const proof of meta.proofs ?? []) {
  if (!proof.proofFile) {
    continue;
  }
  const proofName = proofNameForProofEntry(proof);
  if (!isLeanName(proofName)) {
    errors.push(`proof metadata entry is missing a valid proof theorem name: ${proofName ?? "(missing)"}`);
    continue;
  }
  const moduleName = lakeModuleForFile(proofLakeConfig, packageRoot, proof.proofFile);
  if (!moduleName) {
    errors.push(`could not infer proof module for ${proof.proofFile}`);
    continue;
  }

  const declarations = inspectIntroducedDeclarations({
    packageDir: packageRoot,
    moduleName,
    imports: ["Init"],
    label: proof.proofFile,
    errors
  }) ?? [];
  if (!declarations.some((declaration) => declaration.name === proofName && declaration.kind === "theorem")) {
    errors.push(`proof file ${proof.proofFile} missing theorem ${proofName}`);
  }
}

function checkProofLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Proofs`) {
    errors.push(`proof lakefile should declare package ${namespaceRoot}.Proofs`);
  }
  const localSurfaceDependency = lakeDependencies(config).find(
    (dependency) => dependency.kind === "local" && dependency.name === `${namespaceRoot}.Surface`
  );
  if (!localSurfaceDependency || normalizePath(localSurfaceDependency.path) !== "surface-package") {
    errors.push(`proof lakefile should require local package ${namespaceRoot}.Surface from ./surface-package`);
  }
  const hasProofLib = hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Proofs`);
  if (!hasProofLib) {
    errors.push(`proof lakefile should declare lean_lib ${namespaceRoot}.Proofs`);
  } else if (!hasLeanLib(config, (lib) => lib.name === `${namespaceRoot}.Proofs` && normalizePath(lib.srcDir) === "proofs")) {
    errors.push(`proof lakefile should set srcDir := "proofs"`);
  }
}

function checkSurfaceLakefile(config) {
  if (!config) {
    return;
  }
  if (config.name !== `${namespaceRoot}.Surface`) {
    errors.push(`surface lakefile should declare package ${namespaceRoot}.Surface`);
  }
  for (const entry of meta.declarations ?? []) {
    const moduleRoot = entry.folder?.split("/")?.at(-1);
    const surfaceLib = (config.leanLibs ?? []).find((lib) => lib.name === moduleRoot);
    if (moduleRoot && !surfaceLib) {
      errors.push(`surface lakefile should declare lean_lib ${moduleRoot}`);
      continue;
    }
    if (moduleRoot && !(surfaceLib.globs ?? []).includes(`${moduleRoot}.+`)) {
      errors.push(`surface lakefile should set globs := #[\`${moduleRoot}.+]`);
    }
  }
}

function isDirectChildOf(name, namespace) {
  if (!namespace || !name.startsWith(`${namespace}.`)) {
    return false;
  }
  const suffix = name.slice(namespace.length + 1);
  return suffix.length > 0 && !suffix.includes(".");
}

report("namespaces correct", errors);
