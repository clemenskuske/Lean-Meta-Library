#!/usr/bin/env node
import { basename, extname } from "node:path";
import { loadContext, relativePath, report, walkFiles } from "./common.mjs";

const { packageRoot } = loadContext();
const errors = [];
const allowedExtensions = new Set([".lean", ".tex", ".yaml", ".yml", ".json", ".bib", ".md", ".txt"]);
const allowedExtensionless = new Set(["lean-toolchain", "LICENSE", "README"]);

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
}

report("check filetypes", errors);
