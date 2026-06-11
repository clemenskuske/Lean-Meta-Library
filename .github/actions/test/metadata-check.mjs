#!/usr/bin/env node
// Validates metadata against meta.config.yaml, then runs semantic checks that need repository context.
// Metadata is the ground truth for file positions, so statement and proof entries must name their files explicitly.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import YAML from "yaml";
import { loadContext } from "./general/meta-context.mjs";
import {
  namespaceOfDeclaration,
  report,
  requireMeta
} from "./common.mjs";

const context = loadContext();
const { packageRoot, metaText } = context;
const rawMeta = YAML.parse(metaText || "") ?? {};
const errors = [];
const warnings = [];
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const schemaPath = join(repoRoot, "meta.config.yaml");

requireMeta(context, errors);
const schemaValid = validateAgainstSchema(rawMeta);

if (schemaValid) {
  runRepositoryChecks();
}

report("metadata check", errors, warnings);

function validateAgainstSchema(value) {
  if (!existsSync(schemaPath)) {
    errors.push(`metadata config file not found: ${schemaPath}`);
    return false;
  }

  const schema = YAML.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  if (validate(value)) {
    return true;
  }

  for (const error of validate.errors ?? []) {
    errors.push(`metadata schema ${formatSchemaError(error)}`);
  }
  return false;
}

function formatSchemaError(error) {
  const location = error.instancePath || "/";
  const property = error.params?.additionalProperty
    ? ` (${error.params.additionalProperty})`
    : "";
  return `${location} ${error.message}${property}`;
}

function runRepositoryChecks() {
  checkExistingPath(rawMeta.statementLakefilePath, "statementLakefilePath");
  checkExistingPath(rawMeta.proofLakefilePath, "proofLakefilePath");
  checkExistingPath(rawMeta.abstractPath, "abstractPath");

  const statements = rawMeta.statements ?? [];
  const statementByName = new Map();
  for (const entry of statements) {
    const label = entry.Name ?? entry.Statement?.Name ?? "(unnamed)";
    checkExistingPath(entry.Statement?.LeanStatement, `statement ${label} Statement.LeanStatement`);
    checkExistingPath(entry.Statement?.LatexDefinition, `statement ${label} Statement.LatexDefinition`);

    if (entry.Statement?.Name) {
      statementByName.set(entry.Statement.Name, entry);
    }

    for (const used of entry.DeclarationReferences ?? []) {
      checkDeclarationReference(used, `DeclarationReferences item in statement ${label}`);
      if (used.Name && namespaceOfDeclaration(used.Name) === namespaceOfDeclaration(entry.Statement?.Name)) {
        errors.push(`DeclarationReferences item in statement ${label} must point to a different namespace: ${used.Name}`);
      }
    }
  }

  for (const proof of rawMeta.proofs ?? []) {
    const label = proof.Name ?? proof.Theorem?.Name ?? "(unnamed proof)";
    checkExistingPath(proof.Theorem?.File, `proof entry ${label} Theorem.File`);
    checkExistingPath(proof.Proof?.File, `proof entry ${label} Proof.File`);

    const theoremEntry = statementByName.get(proof.Theorem?.Name);
    if (!theoremEntry) {
      errors.push(`proof entry ${label} does not match a metadata statement: ${proof.Theorem?.Name}`);
    } else if (theoremEntry.Type !== "Axiom") {
      errors.push(`proof entry ${label} must target an Axiom statement, found ${theoremEntry.Type}: ${proof.Theorem?.Name}`);
    }

    for (const used of proof.DeclarationReferences ?? []) {
      checkDeclarationReference(used, `DeclarationReferences item in proof ${label}`);
    }
  }

  const metadataStrings = collectStrings(rawMeta);
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
}

function checkDeclarationReference(reference, label) {
  const leanDir = pathDirectory(reference.LeanStatement);
  const latexDir = pathDirectory(reference.LatexDefinition);
  if (leanDir !== latexDir) {
    errors.push(`${label} LeanStatement and LatexDefinition must be in the same folder`);
  }
}

function pathDirectory(path) {
  return path ? dirname(path) : "";
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
