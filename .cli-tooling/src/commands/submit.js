import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { lmlEnv } from "../lib/project-env.js";
import { getRepoConfig } from "../lib/repo.js";
import { run } from "../lib/process.js";
import { test } from "./test.js";

const defaultManifestPath = String(lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml");
const issueNumberField = "submissionIssueNumber";
const issueUrlField = "submissionIssueUrl";

export async function submit({ args, cwd }) {
  const { manifestPath, shouldRunTests } = parseArgs(args, cwd);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });

  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}.`);
  }
  if (!statSync(manifestPath).isFile()) {
    throw new Error(`Manifest path must be a file: ${manifestPath}.`);
  }
  if (!isManifestFile(manifestPath)) {
    throw new Error("Use a manifest .yaml or .yml file argument: lml submit [--no-prior-test] --manifest=path/to/manifest.yaml");
  }

  const branch = currentBranch(repoRoot);
  const commit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const sourceRepo = githubRepo(repoRoot);
  const libraryRepo = getRepoConfig().repo;
  const manifestPathForIssue = toRepoRelativePath(repoRoot, manifestPath);

  if (shouldRunTests) {
    await test({ args: [manifestPath], cwd });
  }

  ensureRemoteHasCurrentCommit({ repoRoot, branch, commit });
  ensureGitHubCli();
  ensureAuthenticated();

  const submitter = githubUser();
  const issue = createOrUpdateSubmissionIssue({
    libraryRepo,
    sourceRepo,
    repoRoot,
    manifestPath,
    manifestPathForIssue,
    branch,
    commit,
    submitter
  });

  recordSubmissionIssue({ manifestPath, issue, commit });

  if (hasUncommittedPath(repoRoot, manifestPathForIssue)) {
    run("git", ["add", manifestPathForIssue], { cwd: repoRoot });
    run("git", ["commit", "-m", "Record submission issue"], { cwd: repoRoot });
    run("git", ["push", "origin", `HEAD:${branch}`], { cwd: repoRoot, stdio: "inherit" });
  }

  console.log(`Submitted ${sourceRepo}@${commit} on ${branch} with ${manifestPathForIssue}.`);
  console.log(`Submission issue: ${issue.url}`);
}

function parseArgs(args, cwd) {
  let shouldRunTests = true;
  const positional = [];
  let manifestPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-prior-test") {
      shouldRunTests = false;
      continue;
    }
    if (arg === "--manifest") {
      if (manifestPath) {
        throw new Error("Use one manifest file argument: lml submit --manifest=path/to/manifest.yaml");
      }
      manifestPath = args[index + 1];
      index += 1;
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest.");
      }
      continue;
    }
    if (arg.startsWith("--manifest=")) {
      if (manifestPath) {
        throw new Error("Use one manifest file argument: lml submit --manifest=path/to/manifest.yaml");
      }
      manifestPath = arg.slice("--manifest=".length);
      if (!manifestPath) {
        throw new Error("Missing manifest path after --manifest=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown submit option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (manifestPath && positional.length > 0)) {
    throw new Error("Use one manifest file argument: lml submit [--no-prior-test] --manifest=path/to/manifest.yaml");
  }

  return {
    manifestPath: resolveMetaArgument(cwd, manifestPath ?? positional[0] ?? defaultManifestPath),
    shouldRunTests
  };
}

function resolveMetaArgument(cwd, manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolve(cwd, manifestPath);
}

function isManifestFile(path) {
  return /\.ya?ml$/i.test(path);
}

function currentBranch(repoRoot) {
  const branch = run("git", ["branch", "--show-current"], { cwd: repoRoot });
  if (!branch) {
    throw new Error("Cannot submit from a detached HEAD. Check out a branch first.");
  }
  return branch;
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
    throw new Error(`Manifest file must be inside the current repository: ${path}`);
  }
  return relativePath.split(sep).join("/");
}

function ensureRemoteHasCurrentCommit({ repoRoot, branch, commit }) {
  const remoteRef = run("git", ["ls-remote", "origin", `refs/heads/${branch}`], { cwd: repoRoot });
  const remoteCommit = remoteRef.split(/\s+/)[0];

  if (!remoteCommit) {
    throw new Error(`Branch ${branch} was not found on origin. Push it before submitting.`);
  }
  if (remoteCommit !== commit) {
    throw new Error(
      `origin/${branch} is at ${remoteCommit}, but local HEAD is ${commit}. Push the current commit before submitting.`
    );
  }
}

function createOrUpdateSubmissionIssue({
  libraryRepo,
  sourceRepo,
  repoRoot,
  manifestPath,
  manifestPathForIssue,
  branch,
  commit,
  submitter
}) {
  ensureSubmissionLabel(libraryRepo);

  const manifestText = readFileSync(manifestPath, "utf8");
  const submissionName = readTopLevelScalar(manifestText, "SubmissionName");
  const submissionSlug = readTopLevelScalar(manifestText, "SubmissionSlug");
  const abstractPath = readTopLevelScalar(manifestText, "AbstractPath");
  const title = submissionName || submissionSlug || manifestPathForIssue;
  const existingIssue =
    existingCentralIssue({ manifestText, libraryRepo }) ??
    findOpenSubmissionIssue({ libraryRepo, title, sourceRepo, manifestPathForIssue });
  const body = issueBody({
    repoRoot,
    manifestPath,
    manifestPathForIssue,
    abstractPath,
    sourceRepo,
    branch,
    commit,
    submitter
  });

  if (existingIssue) {
    run("gh", [
      "issue",
      "edit",
      String(existingIssue.number),
      "--repo",
      libraryRepo,
      "--title",
      title,
      "--body",
      body,
      "--add-label",
      "submission"
    ]);
    return ghJson(["issue", "view", String(existingIssue.number), "--repo", libraryRepo, "--json", "number,url"]);
  }

  const url = run("gh", [
    "issue",
    "create",
    "--repo",
    libraryRepo,
    "--title",
    title,
    "--body",
    body,
    "--label",
    "submission"
  ]);
  const issueNumber = issueNumberFromUrl(url);
  return ghJson(["issue", "view", String(issueNumber), "--repo", libraryRepo, "--json", "number,url"]);
}

function existingCentralIssue({ manifestText, libraryRepo }) {
  const issueUrl = readTopLevelScalar(manifestText, issueUrlField);
  if (issueUrl) {
    if (issueUrlRepo(issueUrl) !== libraryRepo) {
      return null;
    }
    const issueNumber = issueNumberFromUrl(issueUrl);
    if (issueNumber) {
      return { number: issueNumber };
    }
    return null;
  }

  const issueNumberValue = readTopLevelScalar(manifestText, issueNumberField);
  const issueNumber = issueNumberValue ? Number.parseInt(issueNumberValue, 10) : null;
  if (!issueNumber || !Number.isInteger(issueNumber)) {
    return null;
  }

  const issue = ghJsonOptional(["issue", "view", String(issueNumber), "--repo", libraryRepo, "--json", "number,url"]);
  return issue?.url && issueUrlRepo(issue.url) === libraryRepo ? issue : null;
}

function findOpenSubmissionIssue({ libraryRepo, title, sourceRepo, manifestPathForIssue }) {
  const issues = ghJsonOptional([
    "issue",
    "list",
    "--repo",
    libraryRepo,
    "--label",
    "submission",
    "--state",
    "open",
    "--search",
    title,
    "--json",
    "number,title,body,url"
  ]);
  if (!Array.isArray(issues)) {
    return null;
  }

  return (
    issues.find((issue) => issue.title === title && issue.body?.includes(`Repo Url: https://github.com/${sourceRepo}`)) ??
    issues.find((issue) => issue.title === title && issue.body?.includes(`Manifest File: ${manifestPathForIssue}`)) ??
    null
  );
}

function issueBody({ repoRoot, manifestPath, manifestPathForIssue, abstractPath, sourceRepo, branch, commit, submitter }) {
  const repoUrl = `https://github.com/${sourceRepo}`;
  const lines = [
    readAbstract(manifestPath, abstractPath),
    "",
    "<!-- lean-meta-library:submission -->",
    "",
    "## Source",
    "",
    `- Submitted By: ${submitter.login || "unknown"}`,
    `- Submitter Id: ${submitter.id || ""}`,
    `- Repo Url: ${repoUrl}`,
    `- Source Branch: ${branch}`,
    `- Source Commit: ${commit}`,
    `- Manifest File: ${manifestPathForIssue}`,
    `- Manifest Url: ${repoBlobUrl({ repoUrl, commit, path: manifestPathForIssue })}`
  ];

  if (abstractPath) {
    const abstractRepoPath = resolveManifestRelativePath(manifestPathForIssue, abstractPath);
    lines.push(`- Abstract Url: ${repoBlobUrl({ repoUrl, commit, path: abstractRepoPath })}`);
  }

  return lines.join("\n");
}

function recordSubmissionIssue({ manifestPath, issue, commit }) {
  let manifestText = readFileSync(manifestPath, "utf8");
  manifestText = setTopLevelScalar(manifestText, issueNumberField, String(issue.number));
  manifestText = setTopLevelScalar(manifestText, issueUrlField, issue.url);
  manifestText = setTopLevelScalar(manifestText, "Commit", commit);
  writeFileSync(manifestPath, manifestText);
}

function readAbstract(manifestPath, abstractPathValue) {
  if (!abstractPathValue) {
    return "_No abstract file is recorded in the submission manifest._";
  }
  const abstractPath = resolve(dirname(manifestPath), abstractPathValue);
  if (!existsSync(abstractPath)) {
    return `_Abstract file not found: ${abstractPathValue}_`;
  }
  const text = readFileSync(abstractPath, "utf8").trim();
  return text || "_The recorded abstract file is empty._";
}

function resolveManifestRelativePath(manifestPath, relativePathValue) {
  return `${dirname(manifestPath).replace(/^\.$/, "")}/${relativePathValue}`.replace(/^\/+/, "").replace(/\/+/g, "/");
}

function repoBlobUrl({ repoUrl, commit, path }) {
  const normalized = String(path ?? "").replace(/^\.\/+/, "").replace(/\\/g, "/");
  return `${repoUrl}/blob/${commit}/${normalized}`;
}

function readTopLevelScalar(text, key) {
  const match = text.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.*?)\\s*$`, "m"));
  if (!match) {
    return null;
  }
  return unquoteYamlScalar(match[1].trim());
}

function setTopLevelScalar(text, key, value) {
  const line = `${key}: ${quoteYamlScalar(value)}`;
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m");
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  const insertionPoint = text.search(/^(StatementSubmissions|ProofSubmissions):/m);
  if (insertionPoint >= 0) {
    const prefix = text.slice(0, insertionPoint);
    const suffix = text.slice(insertionPoint);
    return `${ensureTrailingNewline(prefix)}${line}\n${suffix}`;
  }

  return `${ensureTrailingNewline(text)}${line}\n`;
}

function quoteYamlScalar(value) {
  return JSON.stringify(String(value));
}

function unquoteYamlScalar(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function issueNumberFromUrl(url) {
  const match = String(url ?? "").match(/\/issues\/(\d+)\s*$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function issueUrlRepo(url) {
  const match = String(url ?? "").match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/\d+\s*$/);
  return match?.[1] ?? null;
}

function ensureSubmissionLabel(repo) {
  if (ghJsonOptional(["label", "list", "--repo", repo, "--json", "name"])?.some((label) => label.name === "submission")) {
    return;
  }
  run("gh", ["label", "create", "submission", "--repo", repo, "--color", "0E8A16", "--description", "Lean Meta Library submission"]);
}

function githubUser() {
  return ghJson(["api", "user", "--jq", "{login: .login, id: .id}"]);
}

function ghJson(args) {
  return JSON.parse(run("gh", args, { stdio: "pipe" }));
}

function ghJsonOptional(args) {
  try {
    return ghJson(args);
  } catch {
    return null;
  }
}

function hasUncommittedPath(repoRoot, path) {
  return Boolean(run("git", ["status", "--porcelain", "--", path], { cwd: repoRoot }));
}
