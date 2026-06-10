#!/usr/bin/env node
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

export const submissionRowSchema = {
  type: "object",
  required: [
    "Repo Url",
    "Source Branch",
    "Source Commit",
    "Metadata File",
    "Issue Number",
    "Issue Url",
    "User Login"
  ],
  properties: {
    "Repo Url": { type: "string", minLength: 1 },
    "Git Repo": { type: "string", minLength: 1 },
    "Source Branch": { type: "string", minLength: 1 },
    "Source Commit": { type: "string", pattern: "^[0-9a-fA-F]{40}$" },
    "Metadata File": { type: "string", minLength: 1 },
    "Surface Folder": { type: "string", minLength: 1 },
    "Statement Folder": { type: "string", minLength: 1 },
    "Declaration Folder": { type: "string", minLength: 1 },
    "Proof Folder": { type: "string", minLength: 1 },
    "Lake Statement Package": { type: "string", minLength: 1 },
    "Lake Proof Package": { type: "string", minLength: 1 },
    "Issue Id": { type: "number" },
    "Issue Number": { type: "number" },
    "Issue Url": { type: "string", minLength: 1 },
    "User Id": { type: "number" },
    "User Login": { type: "string", minLength: 1 },
    "Imported At": { type: "string" },
    githubRepo: { type: "string", minLength: 1 },
    statements: { type: "array" },
    declarations: { type: "array" },
    proofs: { type: "array" }
  },
  additionalProperties: true
};

const validate = ajv.compile(submissionRowSchema);

export function validateSubmissionRow(row) {
  const valid = validate(row);
  return {
    valid,
    errors: valid ? [] : [...validate.errors]
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
