#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const apiBase = "https://api.github.com";

const stepNumber = Number.parseInt(process.env.STEP_NUMBER ?? "", 10);
const totalSteps = Number.parseInt(process.env.TOTAL_STEPS ?? "", 10);
const stepName = process.env.STEP_NAME;
const stepDetails = process.env.STEP_DETAILS;
const nextStep = process.env.NEXT_STEP;

main().catch((error) => {
  console.error(`Could not post import progress comment: ${error.message}`);
});

async function main() {
  if (!token || !repository || !issueNumber || !stepName || !stepNumber || !totalSteps) {
    throw new Error("missing required progress comment environment");
  }

  const remainingSteps = Math.max(totalSteps - stepNumber, 0);
  const body = [
    "<!-- lean-meta-library:import-progress -->",
    `### Import progress: step ${stepNumber}/${totalSteps}`,
    "",
    `Completed step: ${stepName}`,
    "Previous step worked: yes",
    `Remaining steps: ${remainingSteps}`,
    nextStep ? `Next step: ${nextStep}` : "Next step: none",
    runId ? `Workflow run: ${serverUrl}/${repository}/actions/runs/${runId}` : null,
    stepDetails ? "" : null,
    stepDetails ? stepDetails.trim() : null
  ]
    .filter((line) => line !== null)
    .join("\n");

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
