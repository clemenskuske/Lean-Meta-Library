#!/usr/bin/env node
// Validates the required metadata keys and the basic shape of statement/declaration and proof entries.
// Metadata is the ground truth for file positions, so statement and proof entries must name their files explicitly.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import YAML from "yaml";
import {
  isInside,
  isLeanName,
  loadContext,
  metadataBibtexEntries,
  metadataProofs,
  metadataStatements,
  namespaceOfDeclaration,
  proofLakefilePath,
  report,
  requireMeta,
  statementLakefilePath,
  statementLatexFileForEntry,
  statementLeanFileForEntry
} from "./common.mjs";

const context = loadContext();
const { packageRoot, meta, metaText } = context;
const rawMeta = YAML.parse(metaText || "") ?? {};
const errors = [];
const warnings = [];

requireMeta(context, errors);

const requiredKeys = [
  "pinnedLeanToolchain",
  "abstractPath",
  "submissionTitle",
  "packageSlug",
  "bibtex-entries"
];
const legacyKeys = [
  "paperTitle",
  "namespaceSlug",
  "surfaceLakefilePath",
  "declarations",
  "bibtex"
];

for (const key of requiredKeys) {
  if (!(key in rawMeta)) {
    errors.push(`missing required metadata key: ${key}`);
  }
}

for (const key of legacyKeys) {
  if (key in rawMeta) {
    errors.push(`legacy metadata key is not allowed in new metadata shape: ${key}`);
  }
}

if (meta.statements && !Array.isArray(meta.statements)) {
  errors.push("statements must be a list when present");
}
if (meta.proofs && !Array.isArray(meta.proofs)) {
  errors.push("proofs must be a list when present");
}
if (Array.isArray(meta.statements) && meta.statements.length > 0 && !statementLakefilePath(meta)) {
  errors.push("statementLakefilePath is required when statements are present");
}
if (Array.isArray(meta.proofs) && meta.proofs.length > 0 && !proofLakefilePath(meta)) {
  errors.push("proofLakefilePath is required when proofs are present");
}

checkRelativePath(statementLakefilePath(meta), `statementLakefilePath ${statementLakefilePath(meta)}`);
checkRelativePath(proofLakefilePath(meta), `proofLakefilePath ${proofLakefilePath(meta)}`);
checkRelativePath(meta.abstractPath, `abstractPath ${meta.abstractPath}`);

const statements = metadataStatements(meta);
const statementByName = new Map();
for (const entry of statements) {
  const label = entry.entryName ?? entry.name ?? "(unnamed)";
  if (!["Definition", "Axiom"].includes(entry.type)) {
    errors.push(`statement ${label} has invalid Type ${entry.type}`);
  }
  if (!entry.entryName) {
    errors.push("statement entry is missing Name");
  }
  if (!entry.name) {
    errors.push(`statement ${label} is missing Statement.Name`);
  } else if (!isLeanName(entry.name)) {
    errors.push(`statement ${label} has invalid Lean name: ${entry.name}`);
  }

  const leanFile = statementLeanFileForEntry(entry);
  const latexFile = statementLatexFileForEntry(entry);
  if (!leanFile) {
    errors.push(`statement ${label} is missing Statement.File`);
  }
  if (!latexFile) {
    errors.push(`statement ${label} is missing Statement.LatexFile`);
  }
  checkRelativePath(leanFile, `statement file ${leanFile}`);
  checkRelativePath(latexFile, `statement LaTeX file ${latexFile}`);

  if (entry.name) {
    statementByName.set(entry.name, entry);
  }

  for (const used of entry.usedSurfaceFiles) {
    checkUsedSurfaceFile(used, `Used Surface Files item in statement ${label}`);
    if (used.name && namespaceOfDeclaration(used.name) === namespaceOfDeclaration(entry.name)) {
      errors.push(`Used Surface Files item in statement ${label} must point to a different namespace: ${used.name}`);
    }
  }
}

for (const proof of metadataProofs(meta)) {
  const label = proof.entryName ?? proof.theorem ?? "(unnamed proof)";
  if (!proof.entryName) {
    errors.push("proof entry is missing Name");
  }
  if (!["proof", "conditional-proof", "reduction"].includes(proof.type)) {
    errors.push(`proof entry ${label} has invalid Type ${proof.type}`);
  }
  if (!proof.theoremPackage) {
    errors.push(`proof entry ${label} is missing Theorem.Package`);
  }
  if (!proof.theoremFile) {
    errors.push(`proof entry ${label} is missing Theorem.File`);
  }
  if (!proof.theorem) {
    errors.push(`proof entry ${label} is missing Theorem.Name`);
  } else if (!isLeanName(proof.theorem)) {
    errors.push(`proof entry ${label} has invalid Theorem.Name: ${proof.theorem}`);
  }
  if (!proof.proofFile) {
    errors.push(`proof entry ${label} is missing Proof.File`);
  }
  if (!proof.proof) {
    errors.push(`proof entry ${label} is missing Proof.Name`);
  } else if (!isLeanName(proof.proof)) {
    errors.push(`proof entry ${label} has invalid Proof.Name: ${proof.proof}`);
  }
  checkRelativePath(proof.theoremFile, `theorem file ${proof.theoremFile}`);
  checkRelativePath(proof.proofFile, `proof file ${proof.proofFile}`);

  const theoremEntry = statementByName.get(proof.theorem);
  if (!theoremEntry) {
    errors.push(`proof entry ${label} does not match a metadata statement: ${proof.theorem}`);
  } else if (theoremEntry.type !== "Axiom") {
    errors.push(`proof entry ${label} must target an Axiom statement, found ${theoremEntry.type}: ${proof.theorem}`);
  }

  for (const used of proof.usedSurfaceFiles) {
    checkUsedSurfaceFile(used, `Used Surface Files item in proof ${label}`);
  }
}

const metadataStrings = collectStrings(meta);
const allowedText = /^[\t\r\n\x20-\x7E]*$/;
for (const value of metadataStrings) {
  if (!allowedText.test(value)) {
    errors.push(`metadata contains a non-whitelisted character sequence: ${value}`);
  }
}

for (const suspicious of ["`", "$(", "${", ";", "&&", "||", "<", ">"]) {
  if (metadataStrings.some((value) => value.includes(suspicious))) {
    errors.push(`metadata contains suspicious token: ${suspicious}`);
  }
}

checkExistingPath(statementLakefilePath(meta), "statementLakefilePath");
checkExistingPath(proofLakefilePath(meta), "proofLakefilePath");
checkExistingPath(meta.abstractPath, "abstractPath");

if (!Array.isArray(metadataBibtexEntries(meta))) {
  errors.push("bibtex-entries must be a list");
}

for (const key of ["githubRepo", "Lake Proof Package", "Lake Statement Package"]) {
  if (key in meta && typeof meta[key] !== "string") {
    errors.push(`${key} must be a string when present`);
  }
}

function checkUsedSurfaceFile(used, label) {
  for (const [key, value] of [
    ["Package", used.package],
    ["File", used.file],
    ["Name", used.name]
  ]) {
    if (!value) {
      errors.push(`${label} is missing ${key}`);
    }
  }
  checkRelativePath(used.file, `${label} File ${used.file}`);
  if (used.name && !isLeanName(used.name)) {
    errors.push(`${label} has invalid Name: ${used.name}`);
  }
}

function checkRelativePath(value, label) {
  if (!value) {
    return;
  }
  const absolute = resolve(packageRoot, value);
  if (!isInside(packageRoot, absolute)) {
    errors.push(`${label} escapes package root`);
  }
}

function checkExistingPath(value, label) {
  if (value && !existsSync(join(packageRoot, value))) {
    errors.push(`${label} does not exist: ${value}`);
  }
}

function collectStrings(value) {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

report("metadata check", errors, warnings);
