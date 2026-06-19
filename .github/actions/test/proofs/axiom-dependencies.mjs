#!/usr/bin/env node
// Generates expected non-Mathlib final axiom dependencies for each submitted proof.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import YAML from "yaml";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { normalizeSubmissionRow, validateSubmissionRow } from "../../submission-schema.mjs";
import { isLeanName, report } from "../common.mjs";
import { loadContext } from "../general/manifest-context.mjs";

const context = loadContext();
const errors = [];
const warnings = [];
const allowedMathlibAxioms = new Set((lmlEnv.checks?.allowedMathlibAxioms ?? []).map(String).filter(isLeanName));
const submissionRecords = loadSubmissionRecords(context.packageRoot);

generateAxiomDependencies();
report("proof axiom dependency generation", errors, warnings);

function generateAxiomDependencies() {
  const proofs = Array.isArray(context.manifest.proofs) ? context.manifest.proofs : [];
  if (proofs.length === 0) {
    warnings.push("no proof targets were submitted; skipping proof axiom dependency generation");
    return;
  }

  const registryProofByAxiom = proofMap(registryProofEntries());
  const currentProofByAxiom = proofMap(proofs.map(currentProofEntry).filter(Boolean));
  const dependenciesByProof = new Map();

  for (const proof of proofs) {
    if (!isLeanName(proof?.proof)) {
      continue;
    }
    const entry = proofEntryFromNormalizedProof(proof);
    if (!entry) {
      continue;
    }
    const dependencies = expectedDependenciesForProof(entry, {
      currentProofByAxiom,
      registryProofByAxiom
    });
    dependenciesByProof.set(proof.proof, dependencies);
  }

  writeDependenciesToManifest(dependenciesByProof);
}

function expectedDependenciesForProof(proof, indexes) {
  const dependencies = new Set();
  const visiting = new Set();

  for (const dep of proof.deps) {
    collectDependency(dep, dependencies, visiting, indexes);
  }

  return [...dependencies].filter((name) => !allowedMathlibAxioms.has(name)).sort();
}

function collectDependency(axiomName, dependencies, visiting, indexes) {
  if (!isLeanName(axiomName) || allowedMathlibAxioms.has(axiomName)) {
    return;
  }
  if (visiting.has(axiomName)) {
    warnings.push(`proof obligation cycle while generating axiom dependencies at ${axiomName}`);
    dependencies.add(axiomName);
    return;
  }

  const proof = indexes.currentProofByAxiom.get(axiomName) ?? indexes.registryProofByAxiom.get(axiomName);
  if (!proof) {
    dependencies.add(axiomName);
    return;
  }

  if (Array.isArray(proof.axiomDependencies)) {
    for (const dep of proof.axiomDependencies) {
      if (isLeanName(dep) && !allowedMathlibAxioms.has(dep)) {
        dependencies.add(dep);
      }
    }
    return;
  }

  visiting.add(axiomName);
  for (const dep of proof.deps) {
    collectDependency(dep, dependencies, visiting, indexes);
  }
  visiting.delete(axiomName);
}

function writeDependenciesToManifest(dependenciesByProof) {
  if (dependenciesByProof.size === 0) {
    return;
  }

  const manifest = YAML.parse(readFileSync(context.manifestPath, "utf8")) ?? {};
  const proofs = manifest?.ProofSubmissions?.proofs;
  if (!Array.isArray(proofs)) {
    return;
  }

  let changed = false;
  for (const proof of proofs) {
    const proofName = proof?.Name;
    if (!dependenciesByProof.has(proofName)) {
      continue;
    }
    proof.AxiomDependencies = dependenciesByProof.get(proofName);
    changed = true;
  }

  if (changed) {
    writeFileSync(context.manifestPath, YAML.stringify(manifest, { lineWidth: 0 }), "utf8");
  }
}

function proofMap(entries) {
  const byAxiom = new Map();
  for (const entry of entries) {
    if (!entry || byAxiom.has(entry.axiom)) {
      continue;
    }
    byAxiom.set(entry.axiom, entry);
  }
  return byAxiom;
}

function currentProofEntry(proof) {
  return proofEntry({
    proof: proof?.proof,
    axiom: proof?.axiom,
    deps: proof?.deps
  });
}

function proofEntryFromNormalizedProof(proof) {
  return proofEntry({
    proof: proof?.proof,
    axiom: proof?.axiom,
    deps: proof?.deps,
    axiomDependencies: proof?.AxiomDependencies
  });
}

function registryProofEntries() {
  const entries = [];
  for (const record of submissionRecords) {
    for (const proof of record.proofs) {
      const entry = proofEntry({
        proof: proof?.Name ?? proof?.proof,
        axiom: proof?.AxiomReference ?? proof?.axiom,
        deps: proof?.ProofObligations ?? proof?.deps,
        axiomDependencies: proof?.AxiomDependencies
      });
      if (entry) {
        entries.push(entry);
      }
    }
  }
  return entries;
}

function proofEntry({ proof, axiom, deps, axiomDependencies }) {
  if (!isLeanName(proof) || !isLeanName(axiom)) {
    return null;
  }
  return {
    proof,
    axiom,
    deps: Array.isArray(deps) ? deps.filter(isLeanName) : [],
    axiomDependencies: Array.isArray(axiomDependencies) ? axiomDependencies.filter(isLeanName) : null
  };
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
