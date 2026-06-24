#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const apiBase = "https://api.github.com";

main().catch((error) => {
  console.error(`Could not post import failure comment: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!token || !repository || !issueNumber || !runId) {
    throw new Error("missing required failure comment environment");
  }

  const jobs = await workflowJobs();
  const failedJobs = jobs.filter((job) => ["failure", "cancelled", "timed_out"].includes(String(job.conclusion ?? "")));
  const firstFailure = failedJobs[0] ?? null;
  const failedStep = firstFailure?.steps?.find((step) =>
    ["failure", "cancelled", "timed_out"].includes(String(step.conclusion ?? ""))
  );
  const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;

  const body = [
    "<!-- lean-manifest-library:import-failure -->",
    "### Import failed",
    "",
    "The submission import workflow did not complete successfully.",
    `Workflow run: ${runUrl}`,
    firstFailure ? `Failed job: ${firstFailure.name}` : null,
    failedStep ? `Failed step: ${failedStep.name}` : null,
    firstFailure?.conclusion ? `Result: ${firstFailure.conclusion}` : null,
    "",
    "Please open the workflow run for the full log. If the failed step is repository checkout, check that the submitted repository, branch, and commit are accessible to this workflow."
  ]
    .filter((line) => line !== null)
    .join("\n");

  await github("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeSummary(body);
  }
}

async function workflowJobs() {
  const jobs = [];
  let nextPath = `/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`;

  while (nextPath) {
    const { json, next } = await githubPage("GET", nextPath);
    jobs.push(...(json.jobs ?? []));
    nextPath = next;
  }

  return jobs;
}

async function github(method, path, body) {
  const { json } = await githubPage(method, path, body);
  return json;
}

async function githubPage(method, path, body) {
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

  return {
    json: await response.json(),
    next: nextLink(response.headers.get("link"))
  };
}

function nextLink(linkHeader) {
  if (!linkHeader) {
    return null;
  }
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<https:\/\/api\.github\.com([^>]+)>;\s*rel="next"/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function writeSummary(body) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body}\n`);
}
