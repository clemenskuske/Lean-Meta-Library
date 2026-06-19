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
const { manifestText, namespaceRoot, manifest } = context;
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

  // Use normalized manifest so both old-format and new-format manifests are handled.
  const statements = manifest.statements ?? [];
  const statementByName = new Map();
  for (const entry of statements) {
    const statementName = entry.Statement?.Name ?? entry.Name ?? null;
    const label = statementName ?? "(unnamed)";
    if (statementName) {
      statementByName.set(statementName, entry);
    }

    for (const used of entry.DeclarationReferences ?? []) {
      checkDeclarationReference(used, `DeclarationReferences item in statement ${label}`);
      if (used.Name && namespaceOfDeclaration(used.Name) === namespaceOfDeclaration(statementName)) {
        errors.push(`DeclarationReferences item in statement ${label} must point to a different namespace: ${used.Name}`);
      }
    }
  }
  checkStatementDependencyCycles(statements, statementByName);

  for (const proof of manifest.proofs ?? []) {
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
  const strictStrings = manifestStrings.filter((item) => !isDisplayTextPath(item.path)).map((item) => item.value);
  const displayStrings = manifestStrings.filter((item) => isDisplayTextPath(item.path)).map((item) => item.value);
  const allowedText = /^[\t\r\n\x20-\x7E]*$/;
  const allowedDisplayText = /^[^\x00-\x08\x0B\x0C\x0E-\x1F\x7F]*$/;
  for (const value of strictStrings) {
    if (!allowedText.test(value)) {
      errors.push(`manifest contains a non-whitelisted character sequence: ${value}`);
    }
  }
  for (const value of displayStrings) {
    if (!allowedDisplayText.test(value)) {
      errors.push(`manifest contains a non-whitelisted display character sequence: ${value}`);
    }
  }

  for (const suspicious of ["`", "$(", "${", ";", "&&", "||", "<", ">"]) {
    if (strictStrings.some((value) => value.includes(suspicious))) {
      errors.push(`manifest contains suspicious token: ${suspicious}`);
    }
  }
  for (const suspicious of ["`", "$(", "${"]) {
    if (displayStrings.some((value) => value.includes(suspicious))) {
      errors.push(`manifest contains suspicious display token: ${suspicious}`);
    }
  }
}

function checkStatementDependencyCycles(statements, statementByName) {
  const graph = new Map();
  for (const entry of statements) {
    const statementName = entry.Statement?.Name ?? entry.Name ?? null;
    if (!statementName) {
      continue;
    }
    const localDeps = (entry.DeclarationReferences ?? [])
      .map((reference) => reference?.Name)
      .filter((name) => statementByName.has(name));
    graph.set(statementName, localDeps);
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  for (const statementName of graph.keys()) {
    visit(statementName);
  }

  function visit(name) {
    if (visited.has(name)) {
      return;
    }
    if (visiting.has(name)) {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name];
      errors.push(`statement SemanticDependencies contain a cycle: ${cycle.join(" -> ")}`);
      return;
    }

    visiting.add(name);
    stack.push(name);
    for (const dep of graph.get(name) ?? []) {
      visit(dep);
    }
    stack.pop();
    visiting.delete(name);
    visited.add(name);
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

function collectStrings(value, path = []) {
  if (typeof value === "string") {
    return [{ value, path }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, [...path, String(index)]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStrings(item, [...path, key]));
  }
  return [];
}

function isDisplayTextPath(path) {
  const key = path.at(-1);
  return key === "InlineTexReference" || key === "InlineLeanStatement";
}
