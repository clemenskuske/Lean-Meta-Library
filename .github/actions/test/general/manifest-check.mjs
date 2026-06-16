#!/usr/bin/env node
// Validates manifest against manifest.config.yaml, then runs semantic checks that schema cannot express.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import YAML from "yaml";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { loadContext } from "./manifest-context.mjs";
import {
  isLeanName,
  namespaceOfDeclaration,
  report,
  requireManifest
} from "../common.mjs";

const context = loadContext();
const { manifestText, namespaceRoot } = context;
const rawManifest = YAML.parse(manifestText || "") ?? {};
const errors = [];
const warnings = [];
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const schemaPath = join(repoRoot, "manifest.config.yaml");

requireManifest(context, errors);
const schemaValid = validateAgainstSchema(rawManifest);

if (schemaValid) {
  runRepositoryChecks();
}

report("manifest check", errors, warnings);

function validateAgainstSchema(value) {
  if (!existsSync(schemaPath)) {
    errors.push(`manifest config file not found: ${schemaPath}`);
    return false;
  }

  const schema = YAML.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  if (validate(value)) {
    return true;
  }

  for (const error of validate.errors ?? []) {
    errors.push(`manifest schema ${formatSchemaError(error)}`);
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
  const pinnedLeanVersion = String(lmlEnv.lean?.version ?? "").trim();
  const pinnedMathlibRevision = String(lmlEnv.baseImports?.Mathlib?.revision ?? "").trim();

  if (rawManifest.leanVersion !== undefined) {
    if (String(rawManifest.leanVersion).trim() !== pinnedLeanVersion) {
      errors.push(
        `leanVersion must match lml-env.json lean.version (${pinnedLeanVersion}), found ${rawManifest.leanVersion}`
      );
    }
  }

  if (rawManifest.mathlibVersion !== undefined) {
    if (String(rawManifest.mathlibVersion).trim() !== pinnedMathlibRevision) {
      errors.push(
        `mathlibVersion must match lml-env.json baseImports.Mathlib.revision (${pinnedMathlibRevision}), found ${rawManifest.mathlibVersion}`
      );
    }
  }

  const statements = rawManifest.statements ?? [];
  const statementByName = new Map();
  for (const entry of statements) {
    const label = entry.Name ?? entry.Statement?.Name ?? "(unnamed)";
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

  for (const proof of rawManifest.proofs ?? []) {
    const label = proof.proof ?? proof.axiom ?? "(unnamed proof)";
    if (!isLeanName(proof.axiom)) {
      errors.push(`proof entry ${label} is missing a valid axiom name: ${proof.axiom ?? "(missing)"}`);
      continue;
    }
    if (!isLeanName(proof.proof)) {
      errors.push(`proof entry ${label} is missing a valid proof name: ${proof.proof ?? "(missing)"}`);
      continue;
    }
    if (isLocalName(proof.axiom, namespaceRoot)) {
      const statementEntry = statementByName.get(proof.axiom);
      if (!statementEntry) {
        errors.push(`proof entry ${label} targets a current-submission statement axiom not listed in manifest: ${proof.axiom}`);
      } else if (statementEntry.Type !== "Axiom") {
        errors.push(`proof entry ${label} must target an Axiom statement, found ${statementEntry.Type}: ${proof.axiom}`);
      }
    }
  }

  const manifestStrings = collectStrings(rawManifest);
  const allowedText = /^[\t\r\n\x20-\x7E]*$/;
  for (const value of manifestStrings) {
    if (!allowedText.test(value)) {
      errors.push(`manifest contains a non-whitelisted character sequence: ${value}`);
    }
  }

  for (const suspicious of ["`", "$(", "${", ";", "&&", "||", "<", ">"]) {
    if (manifestStrings.some((value) => value.includes(suspicious))) {
      errors.push(`manifest contains suspicious token: ${suspicious}`);
    }
  }
}

function isLocalName(name, root) {
  if (!root || !name) {
    return false;
  }
  return name === root || name.startsWith(`${root}.`);
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
