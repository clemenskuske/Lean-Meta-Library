#!/usr/bin/env node
// Checks that the submission slug is not already present in submissions.jsonl.
// Run `lml update` first to ensure submissions.jsonl is current.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadContext } from "./manifest-context.mjs";
import { report } from "../common.mjs";

const { packageRoot, manifest } = loadContext();
const errors = [];
const warnings = [];

const slug = manifest.submissionSlug ?? null;
if (!slug) {
  errors.push("manifest is missing SubmissionSlug; cannot check uniqueness");
  report("submission slug unique", errors, warnings);
} else {
  const submissionsPath = findSubmissionsJsonl(packageRoot);
  if (!submissionsPath) {
    warnings.push("submissions.jsonl not found; run `lml update` to check slug uniqueness");
  } else {
    checkUniqueness(slug, submissionsPath);
  }
  report("submission slug unique", errors, warnings);
}

function checkUniqueness(slug, path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const existing = record.SubmissionData?.SubmissionSlug ?? record.SubmissionSlug ?? null;
    if (existing === slug) {
      errors.push(`SubmissionSlug "${slug}" is already taken in submissions.jsonl`);
      return;
    }
  }
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
