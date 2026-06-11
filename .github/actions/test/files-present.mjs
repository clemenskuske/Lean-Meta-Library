#!/usr/bin/env node
// Verifies that metadata-listed submission files exist.
// Metadata is also the ground truth for statement/declaration and proof file positions.
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { loadContext } from "./general/meta-context.mjs";
import {
  metadataProofs,
  metadataStatements,
  packageRootForLakefile,
  proofLakefilePath,
  relativePath,
  report,
  requireMeta,
  statementLakefilePath,
  statementLatexFileForEntry,
  statementLeanFileForEntry,
  theoremNameForProofEntry,
  walkFiles
} from "./common.mjs";

const context = loadContext();
const { packageRoot, meta } = context;
const errors = [];
const expectedStatementFiles = new Set();
const expectedProofFiles = new Set();

requireMeta(context, errors);

if (meta.abstractPath && !existsSync(join(packageRoot, meta.abstractPath))) {
  errors.push(`missing abstractPath: ${meta.abstractPath}`);
}

const statements = metadataStatements(meta);
const proofs = metadataProofs(meta);
const statementLakefile = statementLakefilePath(meta);
const proofLakefile = proofLakefilePath(meta);

if (statements.length > 0) {
  if (!statementLakefile) {
    errors.push("missing statementLakefilePath");
  } else if (!existsSync(join(packageRoot, statementLakefile))) {
    errors.push(`missing statement lakefile: ${statementLakefile}`);
  }
}

if (proofs.length > 0) {
  if (!proofLakefile) {
    errors.push("missing proofLakefilePath");
  } else if (!existsSync(join(packageRoot, proofLakefile))) {
    errors.push(`missing proof lakefile: ${proofLakefile}`);
  }
}

for (const entry of statements) {
  const leanFile = statementLeanFileForEntry(entry);
  const latexFile = statementLatexFileForEntry(entry);
  const label = entry.name ?? entry.entryName ?? basename(dirname(leanFile ?? ""));

  if (!leanFile) {
    errors.push(`statement ${label} has no Statement.LeanStatement`);
  } else {
    expectedStatementFiles.add(normalizePath(leanFile));
    if (!existsSync(join(packageRoot, leanFile))) {
      errors.push(`statement ${label} missing Lean file: ${leanFile}`);
    }
  }

  if (!latexFile) {
    errors.push(`statement ${label} has no Statement.LatexDefinition`);
  } else {
    expectedStatementFiles.add(normalizePath(latexFile));
    if (!existsSync(join(packageRoot, latexFile))) {
      errors.push(`statement ${label} missing LaTeX file: ${latexFile}`);
    }
  }
}

for (const proof of proofs) {
  if (!proof.proofFile) {
    errors.push(`proof for ${theoremNameForProofEntry(proof) ?? "(unknown theorem)"} has no Proof.File`);
    continue;
  }
  expectedProofFiles.add(normalizePath(proof.proofFile));
  if (!existsSync(join(packageRoot, proof.proofFile))) {
    errors.push(`proof file missing for ${theoremNameForProofEntry(proof) ?? "(unknown theorem)"}: ${proof.proofFile}`);
  }
}

checkDiskMatchesMetadata();

function checkDiskMatchesMetadata() {
  const statementRoot = statementLakefile
    ? packageRootForLakefile(packageRoot, statementLakefile)
    : defaultExistingDir("surface-package");
  const proofRoots = proofSearchRoots();

  if (statementRoot && existsSync(statementRoot) && statSync(statementRoot).isDirectory()) {
    for (const file of walkFiles(statementRoot).filter(isStatementPositionFile)) {
      const rel = normalizePath(relativePath(packageRoot, file));
      if (!expectedStatementFiles.has(rel)) {
        errors.push(`statement/declaration file is present on disk but not listed in metadata: ${rel}`);
      }
    }
  }

  for (const proofRoot of proofRoots) {
    for (const file of walkFiles(proofRoot).filter((path) => path.endsWith(".lean"))) {
      const rel = normalizePath(relativePath(packageRoot, file));
      if (!expectedProofFiles.has(rel) && basename(file) !== "lakefile.lean") {
        errors.push(`proof file is present on disk but not listed in metadata: ${rel}`);
      }
    }
  }
}

function proofSearchRoots() {
  const roots = new Set();
  const conventionalProofs = defaultExistingDir("proofs");
  if (conventionalProofs) {
    roots.add(conventionalProofs);
  }
  for (const proofFile of expectedProofFiles) {
    const dir = resolve(packageRoot, dirname(proofFile));
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      roots.add(dir);
    }
  }
  return [...roots];
}

function defaultExistingDir(path) {
  const absolute = resolve(packageRoot, path);
  return existsSync(absolute) ? absolute : null;
}

function isStatementPositionFile(path) {
  const name = basename(path);
  if (name === "lakefile.lean") {
    return false;
  }
  return [".lean", ".tex"].includes(extname(path));
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

report("files present", errors);
