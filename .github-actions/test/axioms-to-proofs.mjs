#!/usr/bin/env node
// Checks that every theorem surface declaration has a matching proof metadata entry.
// It also asks Lean to verify that the proof theorem has the same type as the surface declaration.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  declarationNames,
  isConjectureProofEntry,
  loadContext,
  maxBuildOutputBytes,
  proofConstantForTheorem,
  proofModuleForFile,
  proofNamespaceForTheorem,
  readIfExists,
  report,
  surfaceModuleForEntry,
  surfaceNamespaceForEntry
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const proofByTheorem = new Map(
  (meta.proofs ?? []).filter((proof) => !isConjectureProofEntry(proof)).map((proof) => [proof.theorem, proof])
);

for (const entry of (meta.surfaceEntries ?? []).filter((item) => item.type === "Theorem")) {
  const source = readIfExists(join(packageRoot, entry.folder ?? "", "Surface.lean"));
  if (!source) {
    continue;
  }

  const namespace = surfaceNamespaceForEntry(entry);
  const declarations = [
    ...declarationNames(source, "axiom"),
    ...declarationNames(source, "theorem")
  ];
  for (const declarationName of declarations) {
    const fullName = `${namespace}.${declarationName}`;
    const proof = proofByTheorem.get(fullName);
    if (!proof) {
      errors.push(`surface theorem declaration has no matching proof metadata entry: ${fullName}`);
      continue;
    }

    const proofSource = readIfExists(join(packageRoot, proof.proofFile ?? ""));
    if (!proofSource) {
      continue;
    }
    const surfaceModule = surfaceModuleForEntry(entry);
    if (surfaceModule && !proofSource.includes(`import ${surfaceModule}`)) {
      errors.push(`proof file ${proof.proofFile} should import ${surfaceModule}`);
    }
    if (!new RegExp(`\\btheorem\\s+${proofConstantForTheorem(fullName)}\\b`).test(proofSource)) {
      errors.push(`proof file ${proof.proofFile} should prove theorem ${proofConstantForTheorem(fullName)}`);
    }
    checkProofType({ surfaceName: fullName, proof, surfaceModule });
  }
}

function checkProofType({ surfaceName, proof, surfaceModule }) {
  const proofModule = proofModuleForFile(proof.proofFile);
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
