#!/usr/bin/env node
// Checks that every theorem surface declaration has a matching proof metadata entry.
// It also asks Lean to verify that the proof theorem has the same type as the surface declaration.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isConjectureProofEntry,
  loadContext,
  maxBuildOutputBytes,
  proofConstantForTheorem,
  proofNamespaceForTheorem,
  report,
  surfaceNamespaceForEntry
} from "./common.mjs";
import { lakeModuleForFile, loadLakeConfig } from "./lake-config.mjs";
import { inspectIntroducedDeclarations } from "./lean-inspect.mjs";
import { parseLeanImports } from "./lean-imports.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const rootLakeConfig = loadLakeConfig(packageRoot, "root lakefile", errors);
const surfaceRoot = join(packageRoot, "surface-package");
const surfaceLakeConfig = loadLakeConfig(surfaceRoot, "surface lakefile", errors);
const proofByTheorem = new Map(
  (meta.proofs ?? []).filter((proof) => !isConjectureProofEntry(proof)).map((proof) => [proof.theorem, proof])
);

for (const entry of (meta.surfaceEntries ?? []).filter((item) => item.type === "Theorem")) {
  const namespace = surfaceNamespaceForEntry(entry);
  const surfacePath = join(packageRoot, entry.folder ?? "", "Surface.lean");
  const surfaceModule = lakeModuleForFile(surfaceLakeConfig, surfaceRoot, surfacePath);
  if (!surfaceModule) {
    errors.push(`could not infer surface module for ${entry.folder ?? "(missing folder)"}/Surface.lean`);
    continue;
  }

  const importsByFile = parseLeanImports([surfacePath], errors);
  const declarations = inspectIntroducedDeclarations({
    packageDir: surfaceRoot,
    moduleName: surfaceModule,
    imports: ["Init", ...(importsByFile.get(surfacePath) ?? []).filter((imported) => imported !== surfaceModule)],
    label: `${entry.folder ?? "(missing folder)"}/Surface.lean`,
    errors
  }) ?? [];

  for (const declaration of declarations.filter((item) => isDirectChildOf(item.name, namespace) && ["axiom", "theorem"].includes(item.kind))) {
    const fullName = declaration.name;
    const proof = proofByTheorem.get(fullName);
    if (!proof) {
      errors.push(`surface theorem declaration has no matching proof metadata entry: ${fullName}`);
      continue;
    }

    const proofPath = join(packageRoot, proof.proofFile ?? "");
    const proofImports = parseLeanImports([proofPath], errors).get(proofPath) ?? [];
    if (!proofImports.includes(surfaceModule)) {
      errors.push(`proof file ${proof.proofFile} should import ${surfaceModule}`);
    }

    const proofModule = lakeModuleForFile(rootLakeConfig, packageRoot, proof.proofFile);
    const proofNamespace = proofNamespaceForTheorem(fullName);
    const proofConstant = proofConstantForTheorem(fullName);
    const proofDeclarations = proofModule
      ? inspectIntroducedDeclarations({
          packageDir: packageRoot,
          moduleName: proofModule,
          imports: ["Init"],
          label: proof.proofFile,
          errors
        }) ?? []
      : [];
    if (!proofDeclarations.some((item) => item.name === `${proofNamespace}.${proofConstant}` && item.kind === "theorem")) {
      errors.push(`proof file ${proof.proofFile} should prove theorem ${proofConstantForTheorem(fullName)}`);
    }
    checkProofType({ surfaceName: fullName, proof, surfaceModule });
  }
}

function checkProofType({ surfaceName, proof, surfaceModule }) {
  const proofModule = lakeModuleForFile(rootLakeConfig, packageRoot, proof.proofFile);
  const proofNamespace = proofNamespaceForTheorem(surfaceName);
  const proofConstant = proofConstantForTheorem(surfaceName);
  if (!surfaceModule || !proofModule || !proofNamespace || !proofConstant) {
    errors.push(`could not infer proof check target for ${surfaceName}`);
    return;
  }

  const proofName = `${proofNamespace}.${proofConstant}`;
  const tmp = mkdtempSync(join(tmpdir(), "lml-proof-type-"));
  const inspector = join(tmp, "ProofTypeCheck.lean");

  try {
    writeFileSync(inspector, proofTypeInspector({ surfaceModule, proofModule, surfaceName, proofName }));
    const result = spawnSync("lake", ["--dir", packageRoot, "env", "lean", inspector], {
      encoding: "utf8",
      maxBuffer: maxBuildOutputBytes
    });

    if (result.error) {
      errors.push(`could not run Lean proof type check for ${proof.proofFile}: ${result.error.message}`);
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

report("connect axioms to proofs", errors);
