#!/usr/bin/env node
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ajv = new Ajv({ allErrors: true });
const ajv2020 = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const here = dirname(fileURLToPath(import.meta.url));
const recordSchemaPath = join(here, "../../submission-record.config.yaml");

export const legacySubmissionRowSchema = {
  type: "object",
  required: [
    "Repo Url",
    "Source Branch",
    "Source Commit",
    "Manifest File",
    "Issue Number",
    "Issue Url",
    "User Login"
  ],
  properties: {
    "Repo Url": { type: "string", minLength: 1 },
    "Git Repo": { type: "string", minLength: 1 },
    "Source Branch": { type: "string", minLength: 1 },
    "Source Commit": { type: "string", pattern: "^[0-9a-fA-F]{40}$" },
    "Manifest File": { type: "string", minLength: 1 },
    "Statement Folder": { type: "string", minLength: 1 },
    "Declaration Folder": { type: "string", minLength: 1 },
    "Proof Folder": { type: "string", minLength: 1 },
    "Lake Statement Package": { type: "string", minLength: 1 },
    "Lake Proof Package": { type: "string", minLength: 1 },
    LakeStatementPackage: { type: "string", minLength: 1 },
    LakeProofPackage: { type: "string", minLength: 1 },
    "Issue Id": { type: "number" },
    "Issue Number": { type: "number" },
    "Issue Url": { type: "string", minLength: 1 },
    "User Id": { type: "number" },
    "User Login": { type: "string", minLength: 1 },
    "Imported At": { type: "string" },
    githubRepo: { type: "string", minLength: 1 },
    submittedBy: { type: "string", minLength: 1 },
    statements: { type: "array" },
    declarations: { type: "array" },
    proofs: { type: "array" }
  },
  additionalProperties: true
};

export const submissionRowSchema = YAML.parse(readFileSync(recordSchemaPath, "utf8"));
const validateSubmissionRecord = ajv2020.compile(submissionRowSchema);
const validateLegacySubmissionRecord = ajv.compile(legacySubmissionRowSchema);

export function validateSubmissionRow(row) {
  const valid = validateSubmissionRecord(row) || validateLegacySubmissionRecord(row);
  return {
    valid,
    errors: valid ? [] : [...(validateSubmissionRecord.errors ?? []), ...(validateLegacySubmissionRecord.errors ?? [])]
  };
}

export function assertSubmissionRow(row, label = "submission row") {
  const result = validateSubmissionRow(row);
  if (result.valid) {
    return;
  }
  const details = result.errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`${label} does not match submissions.jsonl schema: ${details}`);
}

export function normalizeSubmissionRow(row) {
  const data = row?.SubmissionData ?? {};
  const statements = row?.StatementSubmissions ?? {};
  const proofs = row?.ProofSubmissions ?? {};
  return {
    submissionSlug: stringValue(data.SubmissionSlug ?? row?.SubmissionSlug ?? row?.submissionSlug ?? row?.namespaceSlug),
    submissionName: stringValue(data.SubmissionName ?? row?.SubmissionName ?? row?.submissionName ?? row?.paperTitle ?? row?.title),
    repoUrl: stringValue(data.Repo ?? row?.["Repo Url"] ?? row?.["Git Repo"] ?? row?.githubRepo),
    sourceBranch: stringValue(row?.["Source Branch"] ?? row?.sourceBranch),
    sourceCommit: stringValue(data.Commit ?? row?.["Source Commit"] ?? row?.Commit ?? row?.sourceCommit),
    manifestPath: stringValue(data.ManifestPath ?? row?.["Manifest File"]),
    statementFolder: normalizePath(
      statements.rootFolder ??
        row?.["Statement Folder"] ??
        row?.["Declaration Folder"] ??
        row?.["Lake Statement Package"] ??
        row?.LakeStatementPackage ??
        dirnamePath(row?.statementLakefilePath)
    ),
    proofFolder: normalizePath(
      proofs.rootFolder ??
        row?.["Proof Folder"] ??
        row?.["Lake Proof Package"] ??
        row?.LakeProofPackage ??
        dirnamePath(row?.proofLakefilePath)
    ),
    issueNumber: data.submissionIssueNumber ?? row?.["Issue Number"] ?? null,
    issueUrl: stringValue(data.submissionIssueUrl ?? row?.["Issue Url"]),
    userLogin: stringValue(data.submittedBy ?? row?.["User Login"] ?? row?.submittedBy),
    userId: stringValue(data.SubmissionUserId ?? row?.["User Id"]),
    importedAt: stringValue(row?.["Imported At"] ?? row?.importedAt),
    statements: Array.isArray(statements.statements) ? statements.statements : (Array.isArray(row?.statements) ? row.statements : []),
    proofs: Array.isArray(proofs.proofs) ? proofs.proofs : (Array.isArray(row?.proofs) ? row.proofs : []),
    declarations: Array.isArray(row?.declarations) ? row.declarations : []
  };
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function dirnamePath(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function normalizePath(path) {
  return String(path ?? "").trim().replace(/^\.?\//, "").replace(/\/$/g, "");
}
