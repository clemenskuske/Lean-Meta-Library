#!/usr/bin/env node
// Validates the required metadata keys and the basic shape of surface and proof entries.
// It also applies a small character/token whitelist to catch suspicious metadata early.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isInside, loadContext, report, requireMeta } from "./common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];
const warnings = [];

requireMeta(context, errors);

const requiredKeys = [
  "pinnedLeanToolchain",
  "proofLakefilePath",
  "paperTitle",
  "namespaceSlug",
  "surfaceLakefilePath",
  "abstractPath",
  "declarations",
  "proofs"
];

for (const key of requiredKeys) {
  if (!(key in meta)) {
    errors.push(`missing required metadata key: ${key}`);
  }
}

checkRelativePath(meta.proofLakefilePath, `proofLakefilePath ${meta.proofLakefilePath}`);
checkRelativePath(meta.surfaceLakefilePath, `surfaceLakefilePath ${meta.surfaceLakefilePath}`);
checkRelativePath(meta.abstractPath, `abstractPath ${meta.abstractPath}`);

if (!Array.isArray(meta.declarations) || meta.declarations.length === 0) {
  errors.push("declarations must contain at least one entry");
}

const declarationsByName = new Map();
for (const entry of meta.declarations ?? []) {
  if (!["Definition", "Statement"].includes(entry.type)) {
    errors.push(`declaration ${entry.name ?? "(unnamed)"} has invalid type ${entry.type}`);
  }
  for (const key of ["name", "folder"]) {
    if (!entry[key]) {
      errors.push(`declaration is missing ${key}`);
    }
  }
  if (entry.name) {
    declarationsByName.set(entry.name, entry);
  }
  checkRelativePath(entry.folder, `declaration folder ${entry.folder}`);
  checkDeclarationFolder(entry.folder, `declaration folder ${entry.folder}`);
  for (const used of entry.usedSurfaceFiles ?? []) {
    checkRelativePath(used.surfaceFile, `used surface file ${used.surfaceFile}`);
    for (const key of ["githubRepo", "slug", "surfaceFile", "definition"]) {
      if (!used[key]) {
        errors.push(`usedSurfaceFiles item in ${entry.name} is missing ${key}`);
      }
    }
    const definitionNamespace = namespaceOfDeclaration(used.definition);
    if (definitionNamespace && definitionNamespace === entry.name) {
      errors.push(`usedSurfaceFiles item in ${entry.name} must point to a different namespace: ${used.definition}`);
    }
  }
}

for (const proof of meta.proofs ?? []) {
  if (!proof.declaration) {
    errors.push("proof entry is missing declaration");
    continue;
  }

  if (!["proof", "conditional-proof", "reduction"].includes(proof.type)) {
    errors.push(`proof entry for ${proof.declaration} has invalid type ${proof.type}`);
  }
  if (!proof.declaration.includes(".Surface.Statement.")) {
    errors.push(`proof entry must target a Surface.Statement declaration: ${proof.declaration}`);
  }
  if (!proof.proofFile) {
    errors.push(`proof entry is missing proofFile: ${proof.declaration}`);
    continue;
  }
  checkRelativePath(proof.proofFile, `proof file ${proof.proofFile}`);

  const declarationNamespace = namespaceOfDeclaration(proof.declaration);
  const declarationEntry = declarationsByName.get(declarationNamespace);
  if (!declarationEntry) {
    errors.push(`proof entry does not match a metadata declaration: ${proof.declaration}`);
  } else if (declarationEntry.type !== "Statement") {
    errors.push(`proof entry must target a Statement declaration, found ${declarationEntry.type}: ${proof.declaration}`);
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

if (meta.surfaceLakefilePath && !existsSync(join(packageRoot, meta.surfaceLakefilePath))) {
  errors.push(`surfaceLakefilePath does not exist: ${meta.surfaceLakefilePath}`);
}

if (meta.proofLakefilePath && !existsSync(join(packageRoot, meta.proofLakefilePath))) {
  errors.push(`proofLakefilePath does not exist: ${meta.proofLakefilePath}`);
}

if (meta.abstractPath && !existsSync(join(packageRoot, meta.abstractPath))) {
  errors.push(`abstractPath does not exist: ${meta.abstractPath}`);
}

if (!Array.isArray(meta.bibtex)) {
  errors.push("bibtex must be a list");
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

function checkDeclarationFolder(value, label) {
  if (!value) {
    return;
  }
  if (!/^surface-package\/[^/]+$/.test(value)) {
    errors.push(`${label} must be a direct child of surface-package`);
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

function namespaceOfDeclaration(name) {
  if (!name || typeof name !== "string") {
    return null;
  }
  const index = name.lastIndexOf(".");
  return index === -1 ? name : name.slice(0, index);
}

report("metadata check", errors, warnings);
