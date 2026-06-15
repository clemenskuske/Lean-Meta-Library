#!/usr/bin/env node
// Verifies that every repository-relative path named by manifest.config.yaml fields exists on disk.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "./meta-context.mjs";
import { report, requireMeta, statementPackageRoot, proofPackageRoot } from "../common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];

requireMeta(context, errors);

checkPath(meta.abstractPath, "abstractPath");
checkPath(meta.licensePath, "licensePath");

const stmtRoot = statementPackageRoot(meta);
if (stmtRoot) {
  checkFile(join(stmtRoot, "lakefile.lean"), "statementRoot/lakefile.lean");
  checkFile(join(stmtRoot, "lean-toolchain"), "statementRoot/lean-toolchain");
}

const pRoot = proofPackageRoot(meta);
if (pRoot) {
  checkFile(join(pRoot, "lakefile.lean"), "proofRoot/lakefile.lean");
  checkFile(join(pRoot, "lean-toolchain"), "proofRoot/lean-toolchain");
}

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
  checkFile(path, label);
}

function checkFile(relativeTo, label) {
  const absolute = join(packageRoot, relativeTo);
  if (!existsSync(absolute)) {
    errors.push(`${label} missing: ${relativeTo}`);
    return;
  }

  if (!statSync(absolute).isFile()) {
    errors.push(`${label} is not a file: ${relativeTo}`);
  }
}

report("metadata files present", errors);
