#!/usr/bin/env node
// Checks that a submission package only contains the first approved file types.
// It also rejects stray macOS metadata files and unknown extensionless files.
import { basename, extname } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import {
  loadContext,
  metadataStatements,
  packageRootForLakefile,
  relativePath,
  report,
  statementLakefilePath,
  statementLatexFileForEntry,
  statementLeanFileForEntry,
  walkFiles
} from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const allowedExtensions = new Set(lmlEnv.submission?.allowedFileExtensions ?? []);
const allowedExtensionless = new Set(lmlEnv.submission?.allowedExtensionlessFiles ?? []);
const statementRoot = statementLakefilePath(meta) ? packageRootForLakefile(packageRoot, statementLakefilePath(meta)) : null;
const expectedStatementPackageFiles = expectedStatementFiles();

for (const file of walkFiles(packageRoot)) {
  const name = basename(file);
  const ext = extname(file);
  const rel = relativePath(packageRoot, file);

  if (name === ".DS_Store") {
    errors.push(`disallowed macOS metadata file: ${rel}`);
    continue;
  }

  if (!ext && !allowedExtensionless.has(name)) {
    errors.push(`extensionless file is not allowed: ${rel}`);
    continue;
  }

  if (ext && !allowedExtensions.has(ext)) {
    errors.push(`file type is not allowed: ${rel}`);
  }

  if (isInStatementPackage(file) && !expectedStatementPackageFiles.has(rel)) {
    errors.push(`statement/declaration package contains a file not listed in metadata: ${rel}`);
  }
}

function expectedStatementFiles() {
  const expected = new Set();
  const lakefile = statementLakefilePath(meta);
  if (lakefile) {
    expected.add(normalizePath(lakefile));
    const rootRel = normalizePath(relativePath(packageRoot, packageRootForLakefile(packageRoot, lakefile)));
    for (const name of ["lean-toolchain", "lake-manifest.json"]) {
      expected.add(normalizePath(rootRel ? `${rootRel}/${name}` : name));
    }
  }
  for (const entry of metadataStatements(meta)) {
    for (const path of [statementLeanFileForEntry(entry), statementLatexFileForEntry(entry)]) {
      if (path) {
        expected.add(normalizePath(path));
      }
    }
  }
  return expected;
}

function isInStatementPackage(file) {
  if (!statementRoot) {
    return false;
  }
  const rel = relativePath(statementRoot, file);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}

report("check filetypes", errors);
