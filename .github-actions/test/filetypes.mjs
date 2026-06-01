#!/usr/bin/env node
// Checks that a submission package only contains the first approved file types.
// It also rejects stray macOS metadata files and unknown extensionless files.
import { basename, extname } from "node:path";
import lmlEnv from "../../lml-env.json" with { type: "json" };
import { loadContext, relativePath, report, walkFiles } from "./common.mjs";

const { packageRoot } = loadContext();
const errors = [];
const allowedExtensions = new Set(lmlEnv.submission?.allowedFileExtensions ?? []);
const allowedExtensionless = new Set(lmlEnv.submission?.allowedExtensionlessFiles ?? []);

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
