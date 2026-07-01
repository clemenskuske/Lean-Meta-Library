#!/usr/bin/env node
// Checks package, folder, and file sizes against conservative first-run limits.
// Defaults come from lml-env.json; local runs may override them with LML_MAX_PACKAGE_BYTES,
// LML_MAX_FOLDER_BYTES, LML_MAX_PROOF_FOLDER_BYTES, and LML_MAX_FILE_BYTES.
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import lmlEnv from "../../../../lml-env.json" with { type: "json" };
import { loadContext } from "./manifest-context.mjs";
import {
  fileSize,
  proofPackageRoot,
  report,
  relativePath,
  statementPackageRoot,
  walkFiles
} from "../common.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];
const maxPackageBytes = Number(process.env.LML_MAX_PACKAGE_BYTES ?? lmlEnv.submissionLimits.maxPackageBytes);
const maxFolderBytes = Number(process.env.LML_MAX_FOLDER_BYTES ?? lmlEnv.submissionLimits.maxFolderBytes);
const maxProofFolderBytes = Number(
  process.env.LML_MAX_PROOF_FOLDER_BYTES ??
    process.env.LML_MAX_FOLDER_BYTES ??
    lmlEnv.submissionLimits.maxProofFolderBytes ??
    maxFolderBytes
);
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

const folderChecks = [
  { folder: statementPackageRoot(manifest) ?? "", limit: maxFolderBytes },
  { folder: proofPackageRoot(manifest) ?? "", limit: maxProofFolderBytes },
  ...(manifest.statements ?? [])
    .map((entry) => dirname(entry?.Statement?.LeanStatement ?? ""))
    .filter(Boolean)
    .map((folder) => ({ folder, limit: maxFolderBytes })),
  ...(manifest.proofs ?? [])
    .map((proof) => dirname(proof?.Proof?.File ?? ""))
    .filter(Boolean)
    .map((folder) => ({ folder, limit: maxProofFolderBytes }))
];

for (const { folder, limit } of folderChecks) {
  if (!folder || folder === ".") {
    continue;
  }
  const absolute = join(packageRoot, folder);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    continue;
  }
  const bytes = walkFiles(absolute).reduce((sum, file) => sum + fileSize(file), 0);
  if (bytes > limit) {
    errors.push(`folder is too large: ${folder} has ${bytes} bytes > ${limit}`);
  }
}

report("check folder sizes", errors);
