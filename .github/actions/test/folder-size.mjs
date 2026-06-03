#!/usr/bin/env node
// Checks package, folder, and file sizes against conservative first-run limits.
// Defaults come from lml-env.json; local runs may override them with LML_MAX_PACKAGE_BYTES,
// LML_MAX_FOLDER_BYTES, and LML_MAX_FILE_BYTES.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import lmlEnv from "../../../lml-env.json" with { type: "json" };
import { fileSize, loadContext, report, relativePath, walkFiles } from "./common.mjs";

const { packageRoot, meta } = loadContext();
const errors = [];
const maxPackageBytes = Number(process.env.LML_MAX_PACKAGE_BYTES ?? lmlEnv.submissionLimits.maxPackageBytes);
const maxFolderBytes = Number(process.env.LML_MAX_FOLDER_BYTES ?? lmlEnv.submissionLimits.maxFolderBytes);
const maxFileBytes = Number(process.env.LML_MAX_FILE_BYTES ?? lmlEnv.submissionLimits.maxFileBytes);

const packageFiles = walkFiles(packageRoot);
const packageBytes = packageFiles.reduce((sum, file) => sum + fileSize(file), 0);
if (packageBytes > maxPackageBytes) {
  errors.push(`package is too large: ${packageBytes} bytes > ${maxPackageBytes} bytes`);
}

for (const file of packageFiles) {
  const bytes = fileSize(file);
  if (bytes > maxFileBytes) {
    errors.push(`file is too large: ${relativePath(packageRoot, file)} has ${bytes} bytes > ${maxFileBytes}`);
  }
}

for (const folder of [
  "surface-package",
  "proofs",
  ...(meta.declarations ?? []).map((entry) => entry.folder).filter(Boolean)
]) {
  const absolute = join(packageRoot, folder);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    continue;
  }
  const bytes = walkFiles(absolute).reduce((sum, file) => sum + fileSize(file), 0);
  if (bytes > maxFolderBytes) {
    errors.push(`folder is too large: ${folder} has ${bytes} bytes > ${maxFolderBytes}`);
  }
}

report("check folder sizes", errors);
