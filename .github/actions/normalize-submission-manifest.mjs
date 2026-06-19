#!/usr/bin/env node
// Normalizes workflow-owned manifest fields before import checks run.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const manifestPath = process.argv[2];

if (!manifestPath) {
  console.error("Usage: normalize-submission-manifest.mjs <manifest-path>");
  process.exit(1);
}

const absoluteManifestPath = resolve(manifestPath);
if (!existsSync(absoluteManifestPath)) {
  console.error(`manifest file not found: ${absoluteManifestPath}`);
  process.exit(1);
}

const issueNumber = positiveInteger(process.env.ISSUE_NUMBER, "ISSUE_NUMBER");
const sourceCommit = stringValue(process.env.SOURCE_COMMIT).toLowerCase();
const updates = {
  Repo: stringValue(process.env.REPO_URL),
  submittedBy: stringValue(process.env.SUBMITTER_LOGIN),
  Commit: sourceCommit,
  submissionIssueNumber: issueNumber,
  submissionIssueUrl: stringValue(process.env.ISSUE_URL)
};

const document = YAML.parseDocument(readFileSync(absoluteManifestPath, "utf8") || "{}");
for (const [key, value] of Object.entries(updates)) {
  if (value !== "") {
    document.set(key, value);
  }
}

writeFileSync(absoluteManifestPath, String(document), "utf8");

function positiveInteger(value, name) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function stringValue(value) {
  return String(value ?? "").trim();
}
