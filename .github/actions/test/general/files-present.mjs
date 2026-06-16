#!/usr/bin/env node
// Verifies that every repository-relative path named by manifest.config.yaml fields exists on disk.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadContext } from "./manifest-context.mjs";
import { report, requireManifest, statementPackageRoot, proofPackageRoot } from "../common.mjs";

const context = loadContext();
const { packageRoot, manifest } = context;
const errors = [];

requireManifest(context, errors);

checkPath(manifest.abstractPath, "abstractPath");
checkPath(manifest.licensePath, "licensePath");

const stmtRoot = statementPackageRoot(manifest);
if (stmtRoot) {
  checkFile(join(stmtRoot, "lakefile.lean"), "statementRoot/lakefile.lean");
  checkFile(join(stmtRoot, "lean-toolchain"), "statementRoot/lean-toolchain");
}

const pRoot = proofPackageRoot(manifest);
if (pRoot) {
  checkFile(join(pRoot, "lakefile.lean"), "proofRoot/lakefile.lean");
  checkFile(join(pRoot, "lean-toolchain"), "proofRoot/lean-toolchain");
}

for (const statement of manifest.statements ?? []) {
  const label = statement.Name ?? statement.Statement?.Name ?? "(unknown statement)";
  checkDeclarationReference(statement.Statement, `statement ${label} Statement`);
  for (const [index, reference] of (statement.DeclarationReferences ?? []).entries()) {
    checkDeclarationReference(reference, `statement ${label} DeclarationReferences[${index}]`);
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

report("manifest files present", errors);
