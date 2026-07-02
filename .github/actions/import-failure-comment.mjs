#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runId = process.env.GITHUB_RUN_ID;
const apiBase = "https://api.github.com";
const progressMarker = "<!-- lean-manifest-library:import-progress -->";

const progressSteps = [
  {
    title: "Required files are present and the manifest shape is valid",
    done: "[\u2713] All needed files are present and the manifest shape is valid",
    failed: "[x] Required files or the manifest shape need attention",
    upcoming: "[ ] Required files must be present and the manifest shape must be valid"
  },
  {
    title: "Submitted packages build",
    done: "[\u2713] The submitted packages were built",
    failed: "[x] The submitted packages did not build",
    upcoming: "[ ] The submitted packages must build"
  },
  {
    title: "Submitted packages were tested",
    done: "[\u2713] The submitted packages were tested for undeclared statements, dissimilar types, and other abnormalities",
    failed: "[x] The submitted packages did not pass the declaration and manifest checks",
    upcoming: "[ ] The submission will be checked for undeclared statements, dissimilar types, and other abnormalities"
  },
  {
    title: "Proof trees build and use only declared axioms",
    done: "[\u2713] The proof tree of each proof was built and checked for undeclared axioms",
    failed: "[x] A proof tree did not build or used an undeclared axiom",
    upcoming: "[ ] The proof tree of each proof must be built and checked for undeclared axioms"
  },
  {
    title: "Submission was added to the repository",
    done: "[\u2713] The imported submission was added to the repository",
    failed: "[x] The imported submission could not be added to the repository",
    upcoming: "[ ] The imported submission will be added to the repository"
  }
];

const workflowSteps = [
  step("Check submitted package", "Checkout Lean Meta Library", "Lean Meta Library workflow files were checked out", "Lean Meta Library workflow checkout failed", 1),
  step("Check submitted package", "Set up Node", "Node was set up for the checker workflow", "Node setup failed", 1),
  step("Check submitted package", "Install Node dependencies", "Node dependencies were installed", "Node dependency installation failed", 1),
  step("Check submitted package", "Set up Lean", "Lean was set up", "Lean setup failed", 1),
  step("Check submitted package", "Read submission issue", "Issue was parsed", "The submission issue could not be parsed", 1),
  step("Check submitted package", "Checkout submitted repository", "Submitted repository was checked out", "The submitted repository could not be checked out", 1),
  step("Check submitted package", "Normalize workflow-created manifest fields", "Workflow-created manifest fields were normalized", "Workflow-created manifest fields could not be normalized", 1),
  step("Check submitted package", "Detect existing submission update", "Existing submission update status was detected", "Existing submission update status could not be detected", 1),
  step("Check submitted package", "Check manifest shape and required files", "Required files and manifest shape were validated", "Required files or manifest shape validation failed", 1),
  step("Check submitted package", "Prepare Lean build/cache", "Lean build/cache preparation completed", "Lean build/cache preparation failed", 2),
  step("Check submitted package", "Run submission checks", "First-run submission checks passed", "First-run submission checks failed", 3),
  step("Check submitted package", "Run submission update policy", "Submission update policy passed", "Submission update policy failed", 3),
  step("Check submitted package", "Generate proof axiom dependencies", "Proof axiom dependencies were generated", "Proof axiom dependency generation failed", 4),
  step("Check submitted package", "Run final proof build", "Final proof build passed", "Final proof build failed", 4),
  step("Check submitted package", "Stage checked manifest", "Checked manifest was staged", "Checked manifest could not be staged", 5),
  step("Check submitted package", "Upload checked manifest", "Checked manifest artifact was uploaded", "Checked manifest artifact could not be uploaded", 5),
  step("Import submission manifest", "Checkout Lean Meta Library", "Lean Meta Library repository was checked out for the import commit", "Lean Meta Library repository checkout failed during import", 5),
  step("Import submission manifest", "Set up Node", "Node was set up for the import commit", "Node setup failed during import", 5),
  step("Import submission manifest", "Install Node dependencies", "Node dependencies were installed for the import commit", "Node dependency installation failed during import", 5),
  step("Import submission manifest", "Download checked manifest", "Checked manifest artifact was downloaded", "Checked manifest artifact could not be downloaded", 5),
  step("Import submission manifest", "Update submissions log", "submissions.jsonl was updated", "submissions.jsonl could not be updated", 5),
  step("Import submission manifest", "Commit submissions log", "submissions.jsonl commit step completed", "submissions.jsonl could not be committed or pushed", 5),
  step("Import submission manifest", "Close imported issue", "Imported issue was closed", "Imported issue could not be closed", 5)
].map((item, index) => ({ ...item, rank: index + 1 }));

const workflowStepByKey = new Map(workflowSteps.map((item) => [item.key, item]));
const progressBoundaryRanks = new Map([
  [0, 0],
  [1, rankFor("Check submitted package", "Check manifest shape and required files")],
  [2, rankFor("Check submitted package", "Prepare Lean build/cache")],
  [3, rankFor("Check submitted package", "Run submission update policy")],
  [4, rankFor("Check submitted package", "Run final proof build")],
  [5, rankFor("Import submission manifest", "Close imported issue")]
]);

main().catch((error) => {
  console.error(`Could not post import failure comment: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (!token || !repository || !issueNumber || !runId) {
    throw new Error("missing required failure comment environment");
  }

  const jobs = await workflowJobs();
  const comments = await issueComments();
  const failedJobs = jobs.filter((job) => ["failure", "cancelled", "timed_out"].includes(String(job.conclusion ?? "")));
  const firstFailure = failedJobs[0] ?? null;
  const failedStep = firstFailure?.steps?.find((step) =>
    ["failure", "cancelled", "timed_out"].includes(String(step.conclusion ?? ""))
  );
  const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
  const lastProgress = lastProgressComment(comments, runId);
  const completedSinceLast = completedWorkflowStepsSinceLastComment(jobs, lastProgress.stepNumber);
  const failedMetadata = workflowStepMetadata(firstFailure, failedStep);
  const failedProgress = failedMetadata?.progress ?? inferFailedProgress(lastProgress.stepNumber);
  const completedThrough = completedProgressIndex(jobs, lastProgress.stepNumber);
  const failureTitle = progressSteps[failedProgress - 1]?.title ?? "submission import";

  const body = [
    "<!-- lean-manifest-library:import-failure -->",
    `### Import failed [${failureTitle}]`,
    "",
    lastProgress.stepNumber > 0
      ? `The last progress comment completed ${lastProgress.stepNumber}/5. The steps below ran after that comment.`
      : "No progress comment was posted before this failure. The steps below show what the workflow managed to do first.",
    "",
    "Workflow steps since the last update:",
    ...completedSinceLast,
    "",
    "Step that did not work:",
    `- ${failureText(firstFailure, failedStep, failedMetadata)}: [${runUrl}](${runUrl})`,
    firstFailure?.conclusion ? `- Result: ${firstFailure.conclusion}` : null,
    "",
    "Submission import progress:",
    ...progressSteps.map((item, index) => `- ${statusText(item, index + 1, completedThrough, failedProgress)}`),
    "",
    "What to check next:",
    `- ${nextAction(failedMetadata, firstFailure, failedStep)}`
  ]
    .filter((line) => line !== null)
    .join("\n");

  await github("POST", `/repos/${repository}/issues/${issueNumber}/comments`, { body });

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeSummary(body);
  }
}

async function issueComments() {
  const comments = [];
  let nextPath = `/repos/${repository}/issues/${issueNumber}/comments?per_page=100`;

  while (nextPath) {
    const { json, next } = await githubPage("GET", nextPath);
    comments.push(...json);
    nextPath = next;
  }

  return comments;
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

function completedWorkflowStepsSinceLastComment(jobs, lastCompletedProgress) {
  const boundaryRank = progressBoundaryRanks.get(lastCompletedProgress) ?? 0;
  const completed = orderedRelevantSteps(jobs).filter(
    ({ metadata, actionStep }) =>
      metadata.rank > boundaryRank &&
      actionStep.conclusion === "success" &&
      !isProgressCommentStep(actionStep.name)
  );

  if (completed.length === 0) {
    return ["- No additional import step completed after the last progress comment."];
  }

  return completed.map(({ metadata }) => `- ${metadata.success}: [${runUrlForComment()}](${runUrlForComment()})`);
}

function completedProgressIndex(jobs, lastCompletedProgress) {
  let completed = lastCompletedProgress;
  for (const { metadata, actionStep } of orderedRelevantSteps(jobs)) {
    if (actionStep.conclusion === "success") {
      completed = Math.max(completed, metadata.progress);
    }
  }
  return completed;
}

function orderedRelevantSteps(jobs) {
  const result = [];
  for (const job of jobs) {
    for (const actionStep of job.steps ?? []) {
      const metadata = workflowStepByKey.get(stepKey(job.name, actionStep.name));
      if (metadata) {
        result.push({ metadata, actionStep, job });
      }
    }
  }
  return result.sort((left, right) => left.metadata.rank - right.metadata.rank);
}

function workflowStepMetadata(job, actionStep) {
  if (!job || !actionStep) {
    return null;
  }
  return workflowStepByKey.get(stepKey(job.name, actionStep.name)) ?? null;
}

function lastProgressComment(comments, currentRunId) {
  const runPattern = new RegExp(`/actions/runs/${escapeRegExp(currentRunId)}(?:\\D|$)`);
  const matching = comments
    .filter((comment) => {
      const body = String(comment.body ?? "");
      return body.includes(progressMarker) && runPattern.test(body);
    })
    .map((comment) => ({
      stepNumber: progressStepNumber(comment.body),
      createdAt: Date.parse(comment.created_at ?? "")
    }))
    .filter((item) => Number.isInteger(item.stepNumber) && item.stepNumber > 0)
    .sort((left, right) => left.createdAt - right.createdAt);

  return matching.at(-1) ?? { stepNumber: 0, createdAt: 0 };
}

function progressStepNumber(body) {
  const match = String(body ?? "").match(/###\s+(\d+)\/5 finished \[/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function failureText(job, actionStep, metadata) {
  if (metadata) {
    return metadata.failure;
  }
  if (job && actionStep) {
    return `${job.name} / ${actionStep.name} failed`;
  }
  if (job) {
    return `${job.name} did not complete`;
  }
  return "The workflow did not report a specific failed step";
}

function inferFailedProgress(lastCompletedProgress) {
  return Math.min(Math.max(lastCompletedProgress + 1, 1), progressSteps.length);
}

function statusText(item, index, completedThrough, failedProgress) {
  if (index === failedProgress) {
    return item.failed;
  }
  if (index <= completedThrough) {
    return item.done;
  }
  return item.upcoming;
}

function nextAction(metadata, job, actionStep) {
  const name = metadata?.name ?? actionStep?.name ?? "";
  if (name === "Checkout submitted repository") {
    return "Check that the submitted repository URL, branch, and commit are public and accessible to this workflow.";
  }
  if (name === "Check manifest shape and required files") {
    return "Open the failed workflow step and fix the missing manifest paths or schema errors it reports.";
  }
  if (name === "Prepare Lean build/cache") {
    return "Open the build/cache step log; the submitted statement or proof package did not complete its Lake build.";
  }
  if (name === "Run submission checks" || name === "Run submission update policy") {
    return "Open the failed checker output; it should name the manifest entry, declaration, type, namespace, or update-policy mismatch.";
  }
  if (name === "Run final proof build" || name === "Generate proof axiom dependencies") {
    return "Open the final proof log; the proof composition or axiom-dependency check did not verify with the declared references.";
  }
  if (metadata?.progress === 5) {
    return "The mathematical checks were already complete. Open the import job log to see why updating or committing submissions.jsonl failed.";
  }
  if (job || actionStep) {
    return "Open the linked workflow run and inspect the failed step log.";
  }
  return "Open the linked workflow run; GitHub did not expose a specific failed step to the comment helper.";
}

function isProgressCommentStep(name) {
  return String(name ?? "").startsWith("Comment progress:");
}

function runUrlForComment() {
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function step(job, name, success, failure, progress) {
  return { job, name, success, failure, progress, key: stepKey(job, name) };
}

function stepKey(job, name) {
  return `${job} / ${name}`;
}

function rankFor(job, name) {
  return workflowSteps.find((item) => item.job === job && item.name === name)?.rank ?? 0;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
