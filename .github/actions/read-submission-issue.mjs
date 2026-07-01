#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const body = process.env.ISSUE_BODY ?? "";
const outputPath = process.env.GITHUB_OUTPUT;
const lmlEnv = JSON.parse(readFileSync("lml-env.json", "utf8"));
const defaultManifestPath = lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml";
const fields = readFields(body);
const repoUrl = fields["Repo Url"] ?? fields["Git Repo"];
const sourceBranch = fields["Source Branch"];
const sourceCommit = fields["Source Commit"];
const manifestPath = fields["Manifest File"] ?? defaultManifestPath;
const submitterId = fields["Submitter Id"] ?? "";
const submitterLogin = normalizeLogin(fields["Submitted By"] ?? fields["Submitter Login"] ?? "");

requireSubmissionMarker(body);
requireValue("Repo Url", repoUrl);
requireValue("Source Branch", sourceBranch);
requireValue("Source Commit", sourceCommit);

if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repoUrl)) {
  throw new Error(`Unsupported repository URL: ${repoUrl}`);
}
if (!/^[A-Za-z0-9._/-]+$/.test(sourceBranch) || sourceBranch.includes("..")) {
  throw new Error(`Unsupported source branch: ${sourceBranch}`);
}
if (!/^[0-9a-fA-F]{40}$/.test(sourceCommit)) {
  throw new Error(`Source Commit must be a full 40-character SHA: ${sourceCommit}`);
}
if (manifestPath.startsWith("/") || manifestPath.split("/").includes("..")) {
  throw new Error(`manifest path must be relative to the submitted repository: ${manifestPath}`);
}

appendOutput("repo-url", repoUrl);
appendOutput("source-branch", sourceBranch);
appendOutput("source-commit", sourceCommit);
appendOutput("manifest-path", manifestPath);
appendOutput("submitter-id", submitterId);
appendOutput("submitter-login", submitterLogin);

function requireSubmissionMarker(text) {
  if (!text.includes("<!-- lean-meta-library:submission -->")) {
    throw new Error("Submission issue is missing the lean-meta-library submission marker.");
  }
}

function readFields(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*-?\s*([^:]+):\s*(.*?)\s*$/);
    if (match) {
      values[match[1].trim()] = match[2].trim();
    }
  }
  return values;
}

function requireValue(name, value) {
  if (!value) {
    throw new Error(`Submission issue is missing ${name}.`);
  }
}

function normalizeLogin(value) {
  return String(value ?? "").trim().replace(/^@/, "");
}

function appendOutput(name, value) {
  if (!outputPath) {
    return;
  }
  writeFileSync(outputPath, `${name}=${value}\n`, { flag: "a" });
}
