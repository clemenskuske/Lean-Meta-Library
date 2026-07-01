#!/usr/bin/env node
// Checks that an update to an existing submission preserves its public statements.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadContext } from "./manifest-context.mjs";
import { report } from "../common.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];
const warnings = [];

const slug = manifest.submissionSlug ?? null;
if (!slug) {
  report("submission update policy", errors, warnings);
} else {
  const submissionsPath = findSubmissionsJsonl(packageRoot);
  if (!submissionsPath) {
    errors.push("submissions.jsonl not found; cannot check submission update policy");
  } else {
    checkUpdatePolicy(slug, submissionsPath);
  }
  report("submission update policy", errors, warnings);
}

function checkUpdatePolicy(slug, submissionsPath) {
  const previous = findSubmissionBySlug(slug, submissionsPath);
  if (!previous) {
    errors.push(`SubmissionSlug "${slug}" is not present in submissions.jsonl`);
    return;
  }

  const previousStatements = statementEntries(previous);
  const nextStatementsByName = new Map(
    statementEntries(manifest).map((statement) => [statement.Name, statement])
  );

  for (const previousStatement of previousStatements) {
    const name = previousStatement.Name;
    if (!name) {
      continue;
    }

    const nextStatement = nextStatementsByName.get(name);
    if (!nextStatement) {
      errors.push(`existing statement is missing from update: ${name}`);
      continue;
    }

    if (
      Object.hasOwn(previousStatement, "InlineLeanStatement") &&
      normalizeLean(previousStatement.InlineLeanStatement) !== normalizeLean(nextStatement.InlineLeanStatement)
    ) {
      errors.push(`InlineLeanStatement changed for existing statement: ${name}`);
    }
  }
}

function findSubmissionBySlug(slug, submissionsPath) {
  const lines = readFileSync(submissionsPath, "utf8").split(/\r?\n/).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      warnings.push(`${submissionsPath}:${index + 1} is not valid JSON; skipping row`);
      continue;
    }

    const existingSlug = record.SubmissionData?.SubmissionSlug ?? record.SubmissionSlug ?? null;
    if (existingSlug === slug) {
      return record;
    }
  }
  return null;
}

function statementEntries(record) {
  return record?.StatementSubmissions?.statements ?? record?.statements ?? [];
}

function normalizeLean(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function findSubmissionsJsonl(start) {
  let dir = resolve(start);
  while (true) {
    const candidate = join(dir, "submissions.jsonl");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
