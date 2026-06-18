import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, posix, dirname } from "node:path";
import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { getRepoConfig } from "../lib/repo.js";
import { run } from "../lib/process.js";
import { parseManifestYaml } from "../../../.github/actions/test/common.mjs";
import { normalizeSubmissionRow } from "../../../.github/actions/submission-schema.mjs";

export async function submissionStatus({ args, cwd }) {
  const issueNumber = parseArgs(args);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  const headCommit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const repo = getRepoConfig().repo;

  ensureGitHubCli();
  ensureAuthenticated();

  const issue = ghJson(["issue", "view", issueNumber, "--repo", repo, "--json", "number,title,state,url,body,labels"]);
  const issueFields = readIssueFields(issue.body ?? "");
  const workflow = workflowStatus({
    repo,
    issueTitle: issue.title,
    sourceCommit: issueFields["Source Commit"] ?? null
  });

  const sourceCommit = issueFields["Source Commit"] ?? null;
  const manifestRelPath = issueFields["Manifest File"] ?? null;
  const imported = importedSubmission({ repoRoot, issueNumber, sourceCommit, manifestRelPath });

  let comparison = null;
  if (sourceCommit && manifestRelPath) {
    const manifestFullPath = join(repoRoot, manifestRelPath);
    const currentManifest = existsSync(manifestFullPath)
      ? parseManifestYaml(readFileSync(manifestFullPath, "utf8"))
      : { declarations: [] };
    comparison = compareWithSourceCommit({ repoRoot, manifestRelPath, sourceCommit, currentManifest });
  }

  printStatus({
    manifestRelPath,
    issue,
    issueNumber,
    imported,
    workflow,
    sourceCommit,
    headCommit,
    comparison
  });
}

function parseArgs(args) {
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith("-")) {
      throw new Error(`Unknown submission-status option: ${arg}`);
    }
    positional.push(arg);
  }
  if (positional.length !== 1) {
    throw new Error("Provide an issue number or URL: lml submission-status <issue-id-or-url>");
  }
  return parseIssueRef(positional[0]);
}

function parseIssueRef(ref) {
  const urlMatch = ref.match(/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  if (/^\d+$/.test(ref)) {
    return ref;
  }
  throw new Error(`Expected an issue number or GitHub issue URL, got: ${ref}`);
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

function workflowStatus({ repo, issueTitle }) {
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
  return { state: "waiting for import" };
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
  const importJob = jobs.find((job) => job.name === "Import submission manifest");

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

function importedSubmission({ repoRoot, issueNumber, sourceCommit, manifestRelPath }) {
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
    rows.find((item) => issueNumber && String(normalizeSubmissionRow(item).issueNumber ?? "") === String(issueNumber)) ??
    rows.find((item) => {
      const normalized = normalizeSubmissionRow(item);
      return sourceCommit && normalized.sourceCommit === sourceCommit && normalized.manifestPath === manifestRelPath;
    }) ??
    null;

  return { imported: Boolean(row), row };
}

function compareWithSourceCommit({ repoRoot, manifestRelPath, sourceCommit, currentManifest }) {
  if (!commitExists(repoRoot, sourceCommit)) {
    return { available: false, reason: `source commit ${sourceCommit} is not available locally` };
  }

  const headCommit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const commitCount = Number(run("git", ["rev-list", "--count", `${sourceCommit}..HEAD`], { cwd: repoRoot }) || "0");
  const sourceTimestamp = Number(run("git", ["show", "-s", "--format=%ct", sourceCommit], { cwd: repoRoot }));
  const headTimestamp = Number(run("git", ["show", "-s", "--format=%ct", "HEAD"], { cwd: repoRoot }));
  const days = Math.max(0, Math.floor((headTimestamp - sourceTimestamp) / 86400));
  const shortstat = optionalGit(repoRoot, ["diff", "--shortstat", `${sourceCommit}..HEAD`]) || "no committed file changes";
  const packageRelRoot = dirname(manifestRelPath).replace(/^\.$/, "");
  const dirty = optionalGit(repoRoot, ["status", "--short", "--", manifestRelPath, ...currentStatementFiles(currentManifest, packageRelRoot)]);
  const statements = compareStatementFiles({ repoRoot, manifestRelPath, sourceCommit, currentManifest });

  return {
    available: true,
    current: sourceCommit === headCommit,
    commitCount,
    days,
    shortstat,
    dirty,
    statements
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

function compareStatementFiles({ repoRoot, manifestRelPath, sourceCommit, currentManifest }) {
  const usedManifestText = optionalGit(repoRoot, ["show", `${sourceCommit}:${manifestRelPath}`]);
  const usedMeta = usedManifestText ? parseManifestYaml(usedManifestText) : { declarations: [] };
  const packageRelRoot = dirname(manifestRelPath).replace(/^\.$/, "");
  const currentFiles = currentStatementFiles(currentManifest, packageRelRoot);
  const usedFiles = currentStatementFiles(usedMeta, packageRelRoot);
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

function currentStatementFiles(manifest, packageRelRoot = "") {
  return [...new Set((manifest.statements ?? []).map((entry) => statementFileForEntry(entry, packageRelRoot)).filter(Boolean))];
}

function statementFileForEntry(entry, packageRelRoot) {
  const file = entry?.Statement?.LeanStatement;
  return file ? posix.join(packageRelRoot, file.replace(/^\.\/+/, "")) : null;
}

function printStatus({ manifestRelPath, issue, issueNumber, imported, workflow, sourceCommit, headCommit, comparison }) {
  console.log(`Submission status for issue #${issueNumber}${issue?.url ? ` (${issue.url})` : ""}`);
  console.log(`Imported: ${imported.imported ? "yes" : "no"}`);

  if (issue) {
    console.log(`Issue state: ${issue.state}`);
    console.log(`Issue title: ${issue.title}`);
  }

  if (manifestRelPath) {
    console.log(`Manifest file: ${manifestRelPath}`);
  }

  console.log(`Workflow state: ${workflowLine(workflow)}`);

  if (!sourceCommit) {
    console.log("Source commit: unavailable");
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
    console.log("Uncommitted manifest/statement changes:");
    console.log(indent(comparison.dirty));
  }

  console.log(`Statement files different: ${comparison.statements.different ? "yes" : "no"}`);
  printList("New statement files", comparison.statements.added);
  printList("Changed statement files", comparison.statements.changed);
  printList("Removed statement files", comparison.statements.removed);
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
