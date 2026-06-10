#!/usr/bin/env node
// Verifies that the required submission package files and folders exist.
// It follows the metadata entries to check every surface file, LaTeX file, and proof file.
// Metadata is also the ground truth for those file positions: extra declaration folders or proof files are rejected.
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { loadContext, relativePath, report, requireMeta, theoremNameForProofEntry, walkFiles } from "./common.mjs";

const context = loadContext();
const { packageRoot, meta, namespaceRoot } = context;
const errors = [];
const metadataDeclarationFolders = new Set();
const metadataProofFiles = new Set();

requireMeta(context, errors);

for (const path of [
  "lakefile.lean",
  "abstract.tex",
  "surface-package",
  "surface-package/lakefile.lean",
  "proofs"
]) {
  const absolute = join(packageRoot, path);
  if (!existsSync(absolute)) {
    errors.push(`missing ${path}`);
  }
}

for (const entry of meta.declarations ?? []) {
  if (!entry.folder) {
    errors.push(`declaration ${entry.name ?? "(unnamed)"} has no folder`);
    continue;
  }

  metadataDeclarationFolders.add(normalizePath(entry.folder));
  const folder = join(packageRoot, entry.folder);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    errors.push(`declaration folder missing: ${entry.folder}`);
    continue;
  }

  for (const file of ["latex-file.tex", "Surface.lean"]) {
    if (!existsSync(join(folder, file))) {
      errors.push(`declaration ${entry.name ?? basename(entry.folder)} missing ${file}`);
    }
  }
}

if (namespaceRoot && existsSync(join(packageRoot, "surface-package", namespaceRoot))) {
  errors.push(`surface package should not contain slug-named aggregate folder: surface-package/${namespaceRoot}`);
}

for (const proof of meta.proofs ?? []) {
  if (!proof.proofFile) {
    errors.push(`proof for ${theoremNameForProofEntry(proof) ?? "(unknown theorem)"} has no proofFile`);
    continue;
  }
  metadataProofFiles.add(normalizePath(proof.proofFile));
  if (!existsSync(join(packageRoot, proof.proofFile))) {
    errors.push(`proof file missing for ${theoremNameForProofEntry(proof) ?? "(unknown theorem)"}: ${proof.proofFile}`);
  }
}

checkDiskMatchesMetadata();

function checkDiskMatchesMetadata() {
  const surfacePackage = join(packageRoot, "surface-package");
  if (existsSync(surfacePackage) && statSync(surfacePackage).isDirectory()) {
    for (const entry of readdirSync(surfacePackage, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const folder = normalizePath(`surface-package/${entry.name}`);
      const hasDeclarationFiles = ["Surface.lean", "latex-file.tex"].some((file) => existsSync(join(surfacePackage, entry.name, file)));
      if (hasDeclarationFiles && !metadataDeclarationFolders.has(folder)) {
        errors.push(`declaration folder is present on disk but not listed in metadata: ${folder}`);
      }
    }
  }

  const proofsRoot = join(packageRoot, "proofs");
  if (existsSync(proofsRoot) && statSync(proofsRoot).isDirectory()) {
    for (const file of walkFiles(proofsRoot).filter((path) => path.endsWith(".lean"))) {
      const rel = normalizePath(relativePath(packageRoot, file));
      if (!metadataProofFiles.has(rel)) {
        errors.push(`proof file is present on disk but not listed in metadata: ${rel}`);
      }
    }
  }
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

report("files present", errors);
