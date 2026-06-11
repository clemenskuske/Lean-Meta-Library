#!/usr/bin/env node
// Verifies that every repository-relative path named by meta.config.yaml fields exists on disk.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "./meta-context.mjs";
import { report, requireMeta } from "../common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];

requireMeta(context, errors);

checkPath(meta.abstractPath, "abstractPath");
checkPath(meta.statementLakefilePath, "statementLakefilePath");
checkPath(meta.statementLeanToolchainPath, "statementLeanToolchainPath");
checkPath(meta.proofLakefilePath, "proofLakefilePath");
checkPath(meta.proofLeanToolchainPath, "proofLeanToolchainPath");

for (const statement of meta.statements ?? []) {
  const label = statement.Name ?? statement.Statement?.Name ?? "(unknown statement)";
  checkDeclarationReference(statement.Statement, `statement ${label} Statement`);
  for (const [index, reference] of (statement.DeclarationReferences ?? []).entries()) {
    checkDeclarationReference(reference, `statement ${label} DeclarationReferences[${index}]`);
  }
}

for (const proof of meta.proofs ?? []) {
  const label = proof.Name ?? proof.Theorem?.Name ?? "(unknown proof)";
  checkDeclarationReference(proof.Theorem, `proof ${label} Theorem`);
  checkPath(proof.Proof?.File, `proof ${label} Proof.File`);
  for (const [index, reference] of (proof.DeclarationReferences ?? []).entries()) {
    checkDeclarationReference(reference, `proof ${label} DeclarationReferences[${index}]`);
  }
}

function checkDeclarationReference(reference, label) {
  if (!reference) {
    errors.push(`${label} is missing`);
    return;
  }
  if (reference.CurrentSubmission !== true) {
    return;
  }
  checkPath(reference.LeanStatement, `${label}.LeanStatement`);
  checkPath(reference.LatexDefinition, `${label}.LatexDefinition`);
}

function checkPath(path, label) {
  if (!path) {
    return;
  }

  const absolute = join(packageRoot, path);
  if (!existsSync(absolute)) {
    errors.push(`${label} missing: ${path}`);
    return;
  }

  if (!statSync(absolute).isFile()) {
    errors.push(`${label} is not a file: ${path}`);
  }
}

report("metadata files present", errors);
