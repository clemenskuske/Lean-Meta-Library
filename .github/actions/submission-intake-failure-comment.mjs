#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const apiBase = "https://api.github.com";

main().catch((error) => {
  console.error(`Could not post submission intake failure comment: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!token || !repository || !issueNumber || !runId) {
    throw new Error("missing required submission intake failure comment environment");
  }

  const body = [
    "<!-- lean-meta-library:submission-intake-failure -->",
    "### Submission issue was not labeled",
    "",
    "This issue contains the Lean Meta Library submission marker, but it could not be labeled automatically.",
    `Workflow run: ${serverUrl}/${repository}/actions/runs/${runId}`,
    "",
    "Check that the issue body includes Repo Url, Source Branch, Source Commit, and a repository-relative Manifest File. If those fields look correct, a maintainer should inspect the workflow run."
  ].join("\n");

  await github("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });
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
