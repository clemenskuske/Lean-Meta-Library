import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { lmlEnv } from "../lib/project-env.js";
import { run } from "../lib/process.js";
import { parseMetaYaml } from "../../../.github/actions/test/common.mjs";

const defaultMetadataPath = String(lmlEnv.submission?.defaultMetadataPath ?? "meta.yaml");

export async function submissionStatus({ args, cwd }) {
  const metaPath = parseArgs(args, cwd);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });

  if (!existsSync(metaPath)) {
    throw new Error(`Metadata file not found: ${metaPath}.`);
  }
  if (!statSync(metaPath).isFile()) {
    throw new Error(`Metadata path must be a file: ${metaPath}.`);
  }
  if (!isMetadataFile(metaPath)) {
    throw new Error("Use a metadata .yaml or .yml file argument: lml submission-status path/to/meta.yaml");
  }

  const metaRelPath = toRepoRelativePath(repoRoot, metaPath);
  const metaText = readFileSync(metaPath, "utf8");
  const meta = parseMetaYaml(metaText);
  const repo = githubRepo(repoRoot);
  const branch = currentBranch(repoRoot);
  const headCommit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const issueNumber = stringValue(meta.submissionIssueNumber);

  let issue = null;
  let issueFields = {};
  let workflow = null;

  if (issueNumber) {
    ensureGitHubCli();
    ensureAuthenticated();
    issue = ghJson(["issue", "view", issueNumber, "--repo", repo, "--json", "number,title,state,url,body,labels"]);
    issueFields = readIssueFields(issue.body ?? "");
    workflow = workflowStatus({
      repo,
      branch,
      issueTitle: issue.title,
      sourceCommit: issueFields["Source Commit"] ?? null
    });
  } else {
    workflow = bestEffortWorkflowStatus({ repo, branch, headCommit });
  }

  const sourceCommit = issueFields["Source Commit"] ?? null;
  const imported = importedSubmission({ repoRoot, issueNumber, sourceCommit, metaRelPath });
  const comparison = sourceCommit
    ? compareWithSourceCommit({ repoRoot, metaRelPath, sourceCommit, currentMeta: meta })
    : null;

  printStatus({
    metaRelPath,
    issue,
    issueNumber,
    imported,
    workflow,
    sourceCommit,
    headCommit,
    comparison
  });
}

function parseArgs(args, cwd) {
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith("-")) {
      throw new Error(`Unknown submission-status option: ${arg}`);
    }
    positional.push(arg);
  }
  if (positional.length > 1) {
    throw new Error("Use one metadata file argument: lml submission-status path/to/meta.yaml");
  }
  return resolveMetaArgument(cwd, positional[0] ?? defaultMetadataPath);
}

function resolveMetaArgument(cwd, metaPath) {
  return isAbsolute(metaPath) ? metaPath : resolve(cwd, metaPath);
}

function isMetadataFile(path) {
  return /\.ya?ml$/i.test(path);
}

function currentBranch(repoRoot) {
  const branch = run("git", ["branch", "--show-current"], { cwd: repoRoot });
  return branch || "(detached)";
}

function githubRepo(repoRoot) {
  const remote = run("git", ["remote", "get-url", "origin"], { cwd: repoRoot });
  const ssh = remote.match(/^git@github\.com:(.+)$/);
  if (ssh) {
    return ssh[1].replace(/\.git$/, "");
  }

  const https = remote.match(/^https:\/\/github\.com\/(.+)$/);
  if (https) {
    return https[1].replace(/\.git$/, "");
  }

  throw new Error(`Origin remote is not a GitHub repository URL: ${remote}`);
}

function toRepoRelativePath(repoRoot, path) {
  const relativePath = relative(repoRoot, path);
  if (relativePath.startsWith("..") || relativePath === "" || isAbsolute(relativePath)) {
    throw new Error(`Metadata file must be inside the current repository: ${path}`);
  }
  return relativePath.split(sep).join("/");
}

function ghJson(args) {
  return JSON.parse(run("gh", args, { stdio: "pipe" }));
}

function ghJsonOptional(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0 || result.error) {
    return null;
  }
  return JSON.parse(result.stdout || "null");
}

function readIssueFields(body) {
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*-?\s*([^:]+):\s*(.*?)\s*$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }
  return fields;
}

function workflowStatus({ repo, branch, issueTitle, sourceCommit }) {
  const submit = latestSubmitRun({ repo, branch, sourceCommit });
  if (isActiveRun(submit)) {
    return runStatus("uploading", submit, "submit.yml");
  }
  if (submit?.conclusion && submit.conclusion !== "success") {
    return runStatus("uploading failed", submit, "submit.yml");
  }

  const importer = latestImportRun({ repo, issueTitle });
  if (isActiveRun(importer)) {
    return importRunStatus(repo, importer);
  }
  if (importer?.conclusion && importer.conclusion !== "success") {
    return importRunStatus(repo, importer);
  }
  if (importer?.conclusion === "success") {
    return runStatus("completed", importer, "import-submission.yml");
  }
  if (submit?.conclusion === "success") {
    return runStatus("waiting for import", submit, "submit.yml");
  }
  return { state: "not running" };
}

function bestEffortWorkflowStatus({ repo, branch, headCommit }) {
  const submit = latestSubmitRun({ repo, branch, sourceCommit: headCommit });
  if (!submit) {
    return { state: "not running" };
  }
  if (isActiveRun(submit)) {
    return runStatus("uploading", submit, "submit.yml");
  }
  if (submit.conclusion && submit.conclusion !== "success") {
    return runStatus("uploading failed", submit, "submit.yml");
  }
  return runStatus("completed", submit, "submit.yml");
}

function latestSubmitRun({ repo, branch, sourceCommit }) {
  const runs = ghJsonOptional([
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    "submit.yml",
    "--branch",
    branch,
    "--limit",
    "20",
    "--json",
    "databaseId,status,conclusion,headSha,createdAt,updatedAt,url,displayTitle,event"
  ]);
  if (!Array.isArray(runs)) {
    return null;
  }
  return runs.find((item) => !sourceCommit || item.headSha === sourceCommit) ?? runs[0] ?? null;
}

function latestImportRun({ repo, issueTitle }) {
  const runs = ghJsonOptional([
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    "import-submission.yml",
    "--event",
    "issues",
    "--limit",
    "30",
    "--json",
    "databaseId,status,conclusion,createdAt,updatedAt,url,displayTitle,event"
  ]);
  if (!Array.isArray(runs)) {
    return null;
  }
  return runs.find((item) => item.displayTitle === issueTitle) ?? runs[0] ?? null;
}

function importRunStatus(repo, runInfo) {
  const detail = ghJsonOptional(["run", "view", String(runInfo.databaseId), "--repo", repo, "--json", "jobs,status,conclusion,url"]);
  const jobs = detail?.jobs ?? [];
  const checkJob = jobs.find((job) => job.name === "Check submitted package");
  const importJob = jobs.find((job) => job.name === "Import submission metadata");

  if (isActiveJob(checkJob)) {
    return runStatus("test", runInfo, "import-submission.yml");
  }
  if (isActiveJob(importJob)) {
    return runStatus("finalizing", runInfo, "import-submission.yml");
  }
  if (checkJob?.conclusion && checkJob.conclusion !== "success") {
    return runStatus("test failed", runInfo, "import-submission.yml");
  }
  if (importJob?.conclusion && importJob.conclusion !== "success") {
    return runStatus("finalizing failed", runInfo, "import-submission.yml");
  }
  return runStatus(runInfo.status === "completed" ? "completed" : "test", runInfo, "import-submission.yml");
}

function runStatus(state, runInfo, workflowName) {
  return {
    state,
    workflowName,
    status: runInfo?.status ?? null,
    conclusion: runInfo?.conclusion ?? null,
    url: runInfo?.url ?? null,
    updatedAt: runInfo?.updatedAt ?? null
  };
}

function isActiveRun(runInfo) {
  return runInfo && ["queued", "in_progress", "waiting", "requested", "pending"].includes(runInfo.status);
}

function isActiveJob(job) {
  return job && ["queued", "in_progress", "waiting", "requested", "pending"].includes(job.status);
}

function importedSubmission({ repoRoot, issueNumber, sourceCommit, metaRelPath }) {
  const path = join(repoRoot, "submissions.jsonl");
  if (!existsSync(path)) {
    return { imported: false, row: null };
  }

  const rows = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const row =
    rows.find((item) => issueNumber && String(item["Issue Number"] ?? "") === String(issueNumber)) ??
    rows.find((item) => sourceCommit && item["Source Commit"] === sourceCommit && item["Metadata File"] === metaRelPath) ??
    null;

  return { imported: Boolean(row), row };
}

function compareWithSourceCommit({ repoRoot, metaRelPath, sourceCommit, currentMeta }) {
  if (!commitExists(repoRoot, sourceCommit)) {
    return { available: false, reason: `source commit ${sourceCommit} is not available locally` };
  }

  const headCommit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const commitCount = Number(run("git", ["rev-list", "--count", `${sourceCommit}..HEAD`], { cwd: repoRoot }) || "0");
  const sourceTimestamp = Number(run("git", ["show", "-s", "--format=%ct", sourceCommit], { cwd: repoRoot }));
  const headTimestamp = Number(run("git", ["show", "-s", "--format=%ct", "HEAD"], { cwd: repoRoot }));
  const days = Math.max(0, Math.floor((headTimestamp - sourceTimestamp) / 86400));
  const shortstat = optionalGit(repoRoot, ["diff", "--shortstat", `${sourceCommit}..HEAD`]) || "no committed file changes";
  const packageRelRoot = dirname(metaRelPath).replace(/^\.$/, "");
  const dirty = optionalGit(repoRoot, ["status", "--short", "--", metaRelPath, ...currentSurfaceFiles(currentMeta, packageRelRoot)]);
  const surface = compareSurfaceFiles({ repoRoot, metaRelPath, sourceCommit, currentMeta });

  return {
    available: true,
    current: sourceCommit === headCommit,
    commitCount,
    days,
    shortstat,
    dirty,
    surface
  };
}

function commitExists(repoRoot, commit) {
  return spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
    cwd: repoRoot,
    stdio: "ignore"
  }).status === 0;
}

function optionalGit(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0 || result.error) {
    return "";
  }
  return result.stdout.trim();
}

function compareSurfaceFiles({ repoRoot, metaRelPath, sourceCommit, currentMeta }) {
  const usedMetaText = optionalGit(repoRoot, ["show", `${sourceCommit}:${metaRelPath}`]);
  const usedMeta = usedMetaText ? parseMetaYaml(usedMetaText) : { surfaceEntries: [] };
  const packageRelRoot = dirname(metaRelPath).replace(/^\.$/, "");
  const currentFiles = currentSurfaceFiles(currentMeta, packageRelRoot);
  const usedFiles = currentSurfaceFiles(usedMeta, packageRelRoot);
  const currentSet = new Set(currentFiles);
  const usedSet = new Set(usedFiles);

  const added = currentFiles.filter((file) => !usedSet.has(file));
  const removed = usedFiles.filter((file) => !currentSet.has(file));
  const changed = currentFiles.filter((file) => {
    if (!usedSet.has(file)) {
      return false;
    }
    const previous = optionalGit(repoRoot, ["show", `${sourceCommit}:${file}`]);
    const current = existsSync(join(repoRoot, file)) ? readFileSync(join(repoRoot, file), "utf8") : "";
    return previous !== current;
  });

  return {
    different: added.length > 0 || removed.length > 0 || changed.length > 0,
    added,
    removed,
    changed
  };
}

function currentSurfaceFiles(meta, packageRelRoot = "") {
  return [...new Set((meta.surfaceEntries ?? []).map((entry) => surfaceFileForEntry(entry, packageRelRoot)).filter(Boolean))];
}

function surfaceFileForEntry(entry, packageRelRoot) {
  const folder = stringValue(entry.folder);
  return folder ? posix.join(packageRelRoot, folder.replace(/\/$/g, ""), "Surface.lean") : null;
}

function printStatus({ metaRelPath, issue, issueNumber, imported, workflow, sourceCommit, headCommit, comparison }) {
  console.log(`Submission status for ${metaRelPath}`);
  console.log(`Submitted: ${issueNumber ? `yes (#${issueNumber}${issue?.url ? `, ${issue.url}` : ""})` : "no"}`);
  console.log(`Imported: ${imported.imported ? "yes" : "no"}`);

  if (issue) {
    console.log(`Issue state: ${issue.state}`);
    console.log(`Issue title: ${issue.title}`);
  }

  console.log(`Workflow state: ${workflowLine(workflow)}`);

  if (!sourceCommit) {
    console.log("Source commit: unavailable until a submission issue exists");
    return;
  }

  console.log(`Source commit: ${sourceCommit}`);
  console.log(`Current commit: ${headCommit}`);

  if (!comparison?.available) {
    console.log(`Commit comparison: unavailable (${comparison?.reason ?? "unknown reason"})`);
    return;
  }

  console.log(
    `Currentness: ${comparison.current ? "current commit" : `${comparison.commitCount} commit(s), ${comparison.days} day(s) since source commit`}`
  );
  console.log(`Changes since source commit: ${comparison.shortstat}`);
  if (comparison.dirty) {
    console.log("Uncommitted metadata/surface changes:");
    console.log(indent(comparison.dirty));
  }

  console.log(`Surface files different: ${comparison.surface.different ? "yes" : "no"}`);
  printList("New surface files", comparison.surface.added);
  printList("Changed surface files", comparison.surface.changed);
  printList("Removed surface files", comparison.surface.removed);
}

function workflowLine(workflow) {
  if (!workflow || workflow.state === "not running") {
    return "not running";
  }
  const detail = [workflow.state];
  if (workflow.workflowName) {
    detail.push(workflow.workflowName);
  }
  if (workflow.status) {
    detail.push(workflow.status);
  }
  if (workflow.conclusion) {
    detail.push(workflow.conclusion);
  }
  if (workflow.url) {
    detail.push(workflow.url);
  }
  return detail.join(" | ");
}

function printList(label, items) {
  if (!items.length) {
    console.log(`${label}: none`);
    return;
  }
  console.log(`${label}:`);
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function indent(text) {
  return text
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

function stringValue(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
