#!/usr/bin/env node
// Verifies that the statement package contains no Lean or LaTeX files outside metadata.
import { existsSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";
import { loadContext } from "../general/meta-context.mjs";
import { report, walkFiles } from "../common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const expectedStatementFiles = new Set();

for (const statement of meta.statements ?? []) {
  addExpected(statement.Statement?.LeanStatement);
  addExpected(statement.Statement?.LatexDefinition);
  for (const reference of statement.DeclarationReferences ?? []) {
    if (reference.CurrentSubmission === true) {
      addExpected(reference.LeanStatement);
      addExpected(reference.LatexDefinition);
    }
  }
}

const statementRoot = statementRootFromMetadata();
if (statementRoot && existsSync(statementRoot) && statSync(statementRoot).isDirectory()) {
  for (const file of walkFiles(statementRoot).filter(isStatementPositionFile)) {
    const rel = normalizePath(relative(packageRoot, file));
    if (!expectedStatementFiles.has(rel)) {
      errors.push(`statement file is present on disk but not listed in metadata: ${rel}`);
    }
  }
}

function statementRootFromMetadata() {
  if (!meta.statementLakefilePath) {
    return null;
  }
  return resolve(packageRoot, dirnamePath(meta.statementLakefilePath));
}

function addExpected(path) {
  if (path) {
    expectedStatementFiles.add(normalizePath(path));
  }
}

function isStatementPositionFile(path) {
  const name = basename(path);
  if (name === "lakefile.lean") {
    return false;
  }
  return [".lean", ".tex"].includes(extname(path));
}

function dirnamePath(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "." : normalized.slice(0, index);
}

function normalizePath(path) {
  return String(path ?? "").trim().split(sep).join("/").replace(/^\.?\//, "").replace(/\/$/g, "");
}

report("no extra statement files", errors);
