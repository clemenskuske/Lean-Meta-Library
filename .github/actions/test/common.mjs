#!/usr/bin/env node
// Shared helper library for the first-run submission checks.
// It walks files, normalizes the small metadata subset we need, and formats pass/fail output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import { slugToPascal } from "./general/meta-context.mjs";

export { parseMetaYaml } from "./general/meta-context.mjs";

export const maxBuildOutputBytes = Number(lmlEnv.checks?.maxBuildOutputBytes ?? 1024 * 1024 * 20);

export function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function walkFiles(root, options = {}) {
  const ignoreDirs = new Set(options.ignoreDirs ?? [".git", ".lake", "node_modules"]);
  const files = [];

  function visit(dir) {
    if (!existsSync(dir)) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          visit(join(dir, entry.name));
        }
        continue;
      }
      if (entry.isFile()) {
        files.push(join(dir, entry.name));
      }
    }
  }

  visit(root);
  return files;
}

export function leanFiles(root) {
  return walkFiles(root).filter((path) => extname(path) === ".lean");
}

export function relativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

export function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function declarationNamespaceForEntry(entry) {
  return entry.name ?? namespaceOfDeclaration(entry.statementName);
}

export function theoremNameForProofEntry(proof) {
  return proof?.theorem ?? proof?.Theorem?.Name ?? null;
}

export function proofNameForProofEntry(proof) {
  return proof?.proof ?? proof?.Proof?.Name ?? null;
}

export function proofFileForProofEntry(proof) {
  return proof?.proofFile ?? proof?.Proof?.File ?? null;
}

export function theoremFileForProofEntry(proof) {
  return proof?.Theorem?.File ?? null;
}

export function metadataPackageSlug(meta) {
  return meta.submissionSlug ?? meta.packageSlug ?? meta.namespaceSlug ?? null;
}

export function metadataSubmissionTitle(meta) {
  return meta.submissionTitle ?? meta.paperTitle ?? meta.paper?.paperTitle ?? null;
}

export function metadataBibtexEntries(meta) {
  return meta["bibtex-entries"] ?? meta.bibtex ?? null;
}

export function statementLakefilePath(meta) {
  return meta.statementLakefilePath ?? meta.surfaceLakefilePath ?? null;
}

export function statementLeanToolchainPath(meta) {
  return meta.statementLeanToolchainPath ?? null;
}

export function proofLakefilePath(meta) {
  return meta.proofLakefilePath ?? null;
}

export function proofLeanToolchainPath(meta) {
  return meta.proofLeanToolchainPath ?? null;
}

export function packageRootForLakefile(packageRoot, lakefilePath) {
  return lakefilePath ? resolve(packageRoot, dirname(lakefilePath)) : null;
}

export function metadataStatements(meta) {
  if (Array.isArray(meta.statements) && meta.statements.length > 0) {
    return meta.statements.map(normalizeStatementEntry);
  }
  return (meta.declarations ?? []).map(normalizeLegacyDeclarationEntry);
}

export function metadataProofs(meta) {
  return (meta.proofs ?? []).map(normalizeProofEntry);
}

export function statementLeanFileForEntry(entry) {
  return entry.file ?? (entry.folder ? `${entry.folder}/Surface.lean` : null);
}

export function statementLatexFileForEntry(entry) {
  return entry.latexFile ?? (entry.folder ? `${entry.folder}/latex-file.tex` : null);
}

export function normalizedUsedSurfaceFiles(items) {
  return (items ?? []).map((item) => ({
    package: item.PackageSlug ?? item.Package ?? packageForSubmissionSlug(item.SubmissionSlug) ?? item.githubRepo ?? item.slug ?? null,
    currentPackage: item.CurrentSubmission === true || item.CurrentPackage === true,
    file: item.LeanStatement ?? item.File ?? item.surfaceFile ?? null,
    latexFile: item.LatexDefinition ?? item.LatexFile ?? null,
    name: item.Name ?? item.definition ?? null,
    raw: item
  }));
}

function packageForSubmissionSlug(slug) {
  return slug ? `${slugToPascal(String(slug))}.Statements` : null;
}

function declarationReferences(entry) {
  return entry.DeclarationReferences ?? entry["Used Surface Files"] ?? entry.usedSurfaceFiles;
}

function normalizeStatementEntry(entry) {
  const statement = entry.Statement ?? {};
  const file = statement.LeanStatement ?? statement.File ?? entry.File ?? null;
  const latexFile = statement.LatexDefinition ?? statement.LatexFile ?? entry.LatexFile ?? null;
  return {
    raw: entry,
    entryName: entry.Name ?? entry.name ?? null,
    type: entry.Type ?? entry.type ?? null,
    name: statement.Name ?? entry.name ?? null,
    statementName: statement.Name ?? entry.name ?? null,
    file,
    latexFile,
    folder: file ? dirname(file).split(sep).join("/") : null,
    usedSurfaceFiles: normalizedUsedSurfaceFiles(declarationReferences(entry))
  };
}

function normalizeLegacyDeclarationEntry(entry) {
  return {
    raw: entry,
    entryName: entry.Name ?? entry.name ?? null,
    type: entry.Type ?? entry.type ?? null,
    name: entry.name ?? entry.Name ?? null,
    statementName: entry.name ?? entry.Name ?? null,
    file: entry.file ?? (entry.folder ? `${entry.folder}/Surface.lean` : null),
    latexFile: entry.latexFile ?? (entry.folder ? `${entry.folder}/latex-file.tex` : null),
    folder: entry.folder ?? null,
    usedSurfaceFiles: normalizedUsedSurfaceFiles(declarationReferences(entry))
  };
}

function normalizeProofEntry(proof) {
  return {
    raw: proof,
    entryName: proof.Name ?? null,
    type: proof.Type ?? proof.type ?? null,
    theorem: proof.Theorem?.Name ?? proof.theorem ?? null,
    theoremPackage: packageForSubmissionSlug(proof.Theorem?.SubmissionSlug) ?? proof.Theorem?.Package ?? null,
    theoremFile: proof.Theorem?.File ?? null,
    proof: proof.Proof?.Name ?? proof.proof ?? null,
    proofFile: proof.Proof?.File ?? proof.proofFile ?? null,
    usedSurfaceFiles: normalizedUsedSurfaceFiles(declarationReferences(proof))
  };
}

export function namespaceOfDeclaration(name) {
  const value = String(name ?? "");
  const index = value.lastIndexOf(".");
  return index === -1 ? value : value.slice(0, index);
}

export function isLeanName(name) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(name ?? ""));
}

export function fileSize(path) {
  return statSync(path).size;
}

export function report(title, errors, warnings = []) {
  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`FAIL ${title}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`PASS ${title}`);
}

export function requireMeta(context, errors) {
  if (!existsSync(context.metaPath)) {
    errors.push(`metadata file not found: ${context.metaPath}`);
  }
}
