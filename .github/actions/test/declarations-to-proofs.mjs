#!/usr/bin/env node
// Checks that every statement declaration has matching proof metadata.
// It asks Lean to verify that the proof-side theorem has the same type as the surface declaration.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declarationNamespaceForEntry,
  isLeanName,
  loadContext,
  maxBuildOutputBytes,
  metadataProofs,
  metadataStatements,
  packageRootForLakefile,
  proofFileForProofEntry,
  proofLakefilePath,
  proofNameForProofEntry,
  report,
  statementLakefilePath,
  statementLeanFileForEntry,
  theoremFileForProofEntry,
  theoremNameForProofEntry
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { inspectIntroducedDeclarations } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const proofRoot = proofLakefilePath(meta) ? packageRootForLakefile(packageRoot, proofLakefilePath(meta)) : packageRoot;
const statementRoot = statementLakefilePath(meta) ? packageRootForLakefile(packageRoot, statementLakefilePath(meta)) : join(packageRoot, "surface-package");
const proofLakeConfig = proofRoot ? loadLakeConfig(proofRoot, "proof lakefile", errors) : null;
const statementLakeConfig = statementRoot ? loadLakeConfig(statementRoot, "statement/declaration lakefile", errors) : null;
const proofs = metadataProofs(meta);
const proofByTheorem = new Map(proofs.map((proof) => [theoremNameForProofEntry(proof), proof]));

for (const entry of metadataStatements(meta).filter((item) => item.type === "Axiom" || item.type === "Statement")) {
  const namespace = declarationNamespaceForEntry(entry);
  const surfacePath = join(packageRoot, statementLeanFileForEntry(entry) ?? "");
  const surfaceModule = lakeModuleForFile(statementLakeConfig, statementRoot, surfacePath);
  if (!surfaceModule) {
    errors.push(`could not infer statement/declaration module for ${statementLeanFileForEntry(entry) ?? "(missing statement file)"}`);
    continue;
  }

  const importsByFile = parseLeanImports([surfacePath], errors);
  const declarations = inspectIntroducedDeclarations({
    packageDir: statementRoot,
    moduleName: surfaceModule,
    imports: ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== surfaceModule)],
    label: `${entry.folder ?? "(missing folder)"}/Surface.lean`,
    errors
  }) ?? [];

  for (const declaration of declarations.filter((item) => isDirectChildOf(item.name, namespace) && item.kind === "axiom")) {
    const fullName = declaration.name;
    const proof = proofByTheorem.get(fullName);
    if (!proof) {
      errors.push(`statement declaration has no matching proof metadata entry: ${fullName}`);
      continue;
    }
    const proofName = proofNameForProofEntry(proof);
    if (!isLeanName(proofName)) {
      errors.push(`proof metadata entry for ${fullName} is missing a valid proof theorem name`);
      continue;
    }

    const proofPath = join(packageRoot, proofFileForProofEntry(proof) ?? "");
    const proofImports = parseLeanImports([proofPath], errors).get(proofPath) ?? [];
    if (!proofImports.includes(surfaceModule)) {
      errors.push(`proof file ${proofFileForProofEntry(proof)} should import ${surfaceModule}`);
    }

    const proofModule = lakeModuleForFile(proofLakeConfig, proofRoot, join(packageRoot, proofFileForProofEntry(proof) ?? ""));
    const proofDeclarations = proofModule
      ? inspectIntroducedDeclarations({
          packageDir: proofRoot,
          moduleName: proofModule,
          imports: ["Init"],
          label: proofFileForProofEntry(proof),
          errors
        }) ?? []
      : [];
    if (!proofDeclarations.some((item) => item.name === proofName && item.kind === "theorem")) {
      errors.push(`proof file ${proofFileForProofEntry(proof)} should prove theorem ${proofName}`);
    }
    checkProofType({ surfaceName: fullName, proof, surfaceModule, proofName });
  }
}

function checkProofType({ surfaceName, proof, surfaceModule, proofName }) {
  const theoremFile = theoremFileForProofEntry(proof);
  const theoremModule = theoremFile ? lakeModuleForFile(statementLakeConfig, statementRoot, join(packageRoot, theoremFile)) : surfaceModule;
  const proofModule = lakeModuleForFile(proofLakeConfig, proofRoot, join(packageRoot, proofFileForProofEntry(proof) ?? ""));
  if (!surfaceModule || !proofModule || !proofName) {
    errors.push(`could not infer proof check target for ${surfaceName}`);
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-type-"));
  const inspector = join(tmp, "ProofTypeCheck.lean");

  try {
    writeFileSync(inspector, proofTypeInspector({ surfaceModule: theoremModule ?? surfaceModule, proofModule, surfaceName, proofName }));
    const result = spawnSync("lake", ["--dir", proofRoot, "env", "lean", inspector], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean proof type check for ${proofFileForProofEntry(proof)}: ${result.error.message}`);
      return;
    }
    if (result.status !== 0) {
      errors.push(`proof theorem type does not match surface declaration for ${surfaceName}\n${result.stdout}${result.stderr}`.trim());
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function isDirectChildOf(name, namespace) {
  if (!namespace || !name.startsWith(`${namespace}.`)) {
    return false;
  }
  const suffix = name.slice(namespace.length + 1);
  return suffix.length > 0 && !suffix.includes(".");
}

function proofTypeInspector({ surfaceModule, proofModule, surfaceName, proofName }) {
  return `import Lean
import ${surfaceModule}
import ${proofModule}

open Lean Meta

#eval show MetaM Unit from do
  let surfaceInfo <- getConstInfo \`${surfaceName}
  let proofInfo <- getConstInfo \`${proofName}
  unless <- isDefEq surfaceInfo.type proofInfo.type do
    throwError "proof theorem type does not match surface declaration type"
`;
}

report("connect declarations to proofs", errors);
