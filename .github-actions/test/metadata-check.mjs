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
  "proofLakefileUrl",
  "paperTitle",
  "namespaceSlug",
  "surfaceLakefilePath",
  "abstractUrl",
  "surfaceEntries",
  "proofs"
];

for (const key of requiredKeys) {
  if (!(key in meta)) {
    errors.push(`missing required metadata key: ${key}`);
  }
}

if (!Array.isArray(meta.surfaceEntries) || meta.surfaceEntries.length === 0) {
  errors.push("surfaceEntries must contain at least one entry");
}

for (const entry of meta.surfaceEntries ?? []) {
  if (!["Definition", "Theorem", "Conjecture"].includes(entry.type)) {
    errors.push(`surface entry ${entry.name ?? "(unnamed)"} has invalid type ${entry.type}`);
  }
  for (const key of ["name", "folder"]) {
    if (!entry[key]) {
      errors.push(`surface entry is missing ${key}`);
    }
  }
  checkRelativePath(entry.folder, `surface entry folder ${entry.folder}`);
  for (const used of entry.usedSurfaceFiles ?? []) {
    checkRelativePath(used.surfaceFile, `used surface file ${used.surfaceFile}`);
    if (!used.githubRepo || !used.slug || !used.definition) {
      warnings.push(`usedSurfaceFiles item in ${entry.name} is missing githubRepo, slug, or definition`);
    }
  }
}

for (const proof of meta.proofs ?? []) {
  for (const key of ["theorem", "proofFile"]) {
    if (!proof[key]) {
      errors.push(`proof entry is missing ${key}`);
    }
  }
  checkRelativePath(proof.proofFile, `proof file ${proof.proofFile}`);
}

const metadataStrings = collectStrings(meta);
const allowedText = /^[A-Za-z0-9_ .:/@+\-()[\],|]*$/;
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

if (meta.abstractUrl && !existsSync(join(packageRoot, meta.abstractUrl))) {
  errors.push(`abstractUrl does not exist: ${meta.abstractUrl}`);
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
