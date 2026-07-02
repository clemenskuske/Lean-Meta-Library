#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const apiBase = "https://api.github.com";

const stepNumber = Number.parseInt(process.env.STEP_NUMBER ?? "", 10);
const totalSteps = Number.parseInt(process.env.TOTAL_STEPS ?? "", 10);
const completedSteps = parseCompletedSteps(process.env.COMPLETED_STEPS ?? "");

const progressSteps = [
  {
    title: "Required files are present and the manifest shape is valid",
    done: "[\u2713] All needed files are present and the manifest shape is valid",
    current: "[>] Required files are being checked and the manifest shape is being validated",
    upcoming: "[ ] Required files must be present and the manifest shape must be valid"
  },
  {
    title: "Submitted packages build",
    done: "[\u2713] The submitted packages were built",
    current: "[>] The submitted packages are now being built",
    upcoming: "[ ] The submitted packages must build"
  },
  {
    title: "Submitted packages were tested",
    done: "[\u2713] The submitted packages were tested for undeclared statements, dissimilar types, and other abnormalities",
    current: "[>] The submission is now being checked for undeclared statements, dissimilar types, and other abnormalities",
    upcoming: "[ ] The submission will be checked for undeclared statements, dissimilar types, and other abnormalities"
  },
  {
    title: "Proof trees build and use only declared axioms",
    done: "[\u2713] The proof tree of each proof was built and checked for undeclared axioms",
    current: "[>] The proof tree of each proof is now being built and checked for undeclared axioms",
    upcoming: "[ ] The proof tree of each proof must be built and checked for undeclared axioms"
  },
  {
    title: "Submission was added to the repository",
    done: "[\u2713] The imported submission was added to the repository",
    current: "[>] The imported submission is now being added to the repository",
    upcoming: "[ ] The imported submission will be added to the repository"
  }
];

main().catch((error) => {
  console.error(`Could not post import progress comment: ${error.message}`);
});

async function main() {
  if (!token || !repository || !issueNumber || !stepNumber || !totalSteps) {
    throw new Error("missing required progress comment environment");
  }

  if (stepNumber < 1 || stepNumber > totalSteps || totalSteps !== progressSteps.length) {
    throw new Error(`invalid progress step ${stepNumber}/${totalSteps}`);
  }

  const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null;
  const heading = `${stepNumber}/${totalSteps} finished [${progressSteps[stepNumber - 1].title}]`;
  const body = [
    "<!-- lean-manifest-library:import-progress -->",
    `### ${heading}`,
    "",
    "Workflow steps since the last update:",
    ...completedSteps.map((step) => `- ${step}: ${runUrl ? `[${runUrl}](${runUrl})` : "workflow run unavailable"}`),
    "",
    "Submission import progress:",
    ...progressSteps.map((step, index) => `- ${statusText(step, index + 1, stepNumber)}`)
  ]
    .filter((line) => line !== null)
    .join("\n");

  await github("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });
}

function parseCompletedSteps(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function statusText(step, index, completedThrough) {
  if (index <= completedThrough) {
    return step.done;
  }
  if (index === completedThrough + 1) {
    return step.current;
  }
  return step.upcoming;
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
