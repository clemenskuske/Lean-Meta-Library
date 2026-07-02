#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import YAML from "yaml";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const manifestPath = process.env.CHECKED_MANIFEST_PATH ?? "checked-submission/manifest.yaml";
const apiBase = "https://api.github.com";

main().catch((error) => {
  console.error(`Could not post import summary comment: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!token || !repository || !issueNumber) {
    throw new Error("missing required summary comment environment");
  }
  if (!existsSync(manifestPath)) {
    throw new Error(`checked manifest not found: ${manifestPath}`);
  }

  const manifest = YAML.parse(readFileSync(manifestPath, "utf8")) ?? {};
  const body = buildImportSummaryComment(manifest);
  await github("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body}\n`);
  }
}

export function buildImportSummaryComment(manifest) {
  const title = stringValue(manifest.SubmissionName) || stringValue(manifest.SubmissionSlug) || "Imported submission";
  const slug = stringValue(manifest.SubmissionSlug);
  const statements = Array.isArray(manifest.StatementSubmissions?.statements)
    ? manifest.StatementSubmissions.statements
    : [];
  const proofs = Array.isArray(manifest.ProofSubmissions?.proofs)
    ? manifest.ProofSubmissions.proofs
    : [];

  return [
    "<!-- lean-manifest-library:import-summary -->",
    `### Imported submission overview [${title}]`,
    "",
    "This is the imported submission as recorded by the workflow. It is meant as a final human-readable check of the public surface.",
    "",
    "Submission:",
    `- Name: ${title}`,
    slug ? `- Slug: ${slug}` : null,
    stringValue(manifest.Repo) ? `- Repository: ${stringValue(manifest.Repo)}` : null,
    stringValue(manifest.Commit) ? `- Commit: ${stringValue(manifest.Commit)}` : null,
    stringValue(manifest.AbstractPath) ? `- Abstract: ${stringValue(manifest.AbstractPath)}` : null,
    "",
    "Surface statements:",
    ...statementLines(statements),
    "",
    "Proofs:",
    ...proofLines(proofs)
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function statementLines(statements) {
  if (statements.length === 0) {
    return ["- None recorded."];
  }

  return statements.map((statement) => {
    const name = stringValue(statement?.Name) || "(unnamed statement)";
    const kind = stringValue(statement?.Type) || "Statement";
    const title = stringValue(statement?.Title);
    const dependencies = leanNameList(statement?.SemanticDependencies);
    const suffix = [
      title ? `title: ${title}` : null,
      dependencies.length > 0 ? `semantic dependencies: ${dependencies.join(", ")}` : "semantic dependencies: none"
    ].filter(Boolean).join("; ");
    return `- ${kind}: ${name}${suffix ? ` (${suffix})` : ""}`;
  });
}

function proofLines(proofs) {
  if (proofs.length === 0) {
    return ["- None recorded."];
  }

  return proofs.map((proof) => {
    const name = stringValue(proof?.Name) || "(unnamed proof)";
    const axiom = stringValue(proof?.AxiomReference) || "(unknown axiom)";
    const title = stringValue(proof?.Title);
    const obligations = leanNameList(proof?.ProofObligations);
    const axiomDependencies = leanNameList(proof?.AxiomDependencies);
    const selfContained = axiomDependencies.length === 0;
    const notes = [
      title ? `title: ${title}` : null,
      `proves: ${axiom}`,
      obligations.length > 0 ? `declared proof obligations: ${obligations.join(", ")}` : "declared proof obligations: none",
      selfContained
        ? "self-contained: yes; all non-Mathlib axioms used by this proof have proofs themselves"
        : `self-contained: no; still depends on unproven axioms: ${axiomDependencies.join(", ")}`
    ].filter(Boolean);

    return `- ${name} (${notes.join("; ")})`;
  });
}

function leanNameList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map(stringValue).filter(isLeanName))].sort();
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function isLeanName(value) {
  return /^[A-Za-z_][A-Za-z0-9_']*(\.[A-Za-z_][A-Za-z0-9_']*)*$/.test(String(value ?? ""));
}

async function github(method, path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed with ${response.status}: ${text}`);
  }

  return response.json();
}
