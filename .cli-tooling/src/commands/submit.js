import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { lmlEnv } from "../lib/project-env.js";
import { run } from "../lib/process.js";
import { test } from "./test.js";

const defaultManifestPath = String(lmlEnv.submission?.defaultManifestPath ?? "manifest.yaml");

export async function submit({ args, cwd }) {
  const { manifestPath, shouldRunTests } = parseArgs(args, cwd);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  const workflowPath = resolve(repoRoot, ".github", "workflows", "submit.yml");

  if (!existsSync(workflowPath)) {
    throw new Error(`Could not find submit workflow at ${workflowPath}.`);
  }
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
  const repo = githubRepo(repoRoot);
  const manifestPathForWorkflow = toRepoRelativePath(repoRoot, manifestPath);

  if (shouldRunTests) {
    await test({ args: [manifestPath], cwd });
  }

  ensureRemoteHasCurrentCommit({ repoRoot, branch, commit });
  ensureGitHubCli();
  ensureAuthenticated();

  run(
    "gh",
    [
      "workflow",
      "run",
      "submit.yml",
      "--repo",
      repo,
      "--ref",
      branch,
      "-f",
      `manifest_path=${manifestPathForWorkflow}`
    ],
    { cwd: repoRoot, stdio: "inherit" }
  );

  console.log(`Submitted ${repo}@${commit} on ${branch} with ${manifestPathForWorkflow}.`);
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
