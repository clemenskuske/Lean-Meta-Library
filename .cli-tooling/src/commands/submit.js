import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { lmlEnv } from "../lib/project-env.js";
import { run } from "../lib/process.js";
import { test } from "./test.js";

const defaultMetadataPath = String(lmlEnv.submission?.defaultMetadataPath ?? "manifest.yaml");

export async function submit({ args, cwd }) {
  const { metaPath, shouldRunTests } = parseArgs(args, cwd);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  const workflowPath = resolve(repoRoot, ".github", "workflows", "submit.yml");

  if (!existsSync(workflowPath)) {
    throw new Error(`Could not find submit workflow at ${workflowPath}.`);
  }
  if (!existsSync(metaPath)) {
    throw new Error(`Metadata file not found: ${metaPath}.`);
  }
  if (!statSync(metaPath).isFile()) {
    throw new Error(`Metadata path must be a file: ${metaPath}.`);
  }
  if (!isMetadataFile(metaPath)) {
    throw new Error("Use a metadata .yaml or .yml file argument: lml submit [--no-prior-test] --meta=path/to/manifest.yaml");
  }

  const branch = currentBranch(repoRoot);
  const commit = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const repo = githubRepo(repoRoot);
  const metaPathForWorkflow = toRepoRelativePath(repoRoot, metaPath);

  if (shouldRunTests) {
    await test({ args: [metaPath], cwd });
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
      `meta_path=${metaPathForWorkflow}`
    ],
    { cwd: repoRoot, stdio: "inherit" }
  );

  console.log(`Submitted ${repo}@${commit} on ${branch} with ${metaPathForWorkflow}.`);
}

function parseArgs(args, cwd) {
  let shouldRunTests = true;
  const positional = [];
  let metaPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-prior-test") {
      shouldRunTests = false;
      continue;
    }
    if (arg === "--meta") {
      if (metaPath) {
        throw new Error("Use one metadata file argument: lml submit --meta=path/to/manifest.yaml");
      }
      metaPath = args[index + 1];
      index += 1;
      if (!metaPath) {
        throw new Error("Missing metadata path after --meta.");
      }
      continue;
    }
    if (arg.startsWith("--meta=")) {
      if (metaPath) {
        throw new Error("Use one metadata file argument: lml submit --meta=path/to/manifest.yaml");
      }
      metaPath = arg.slice("--meta=".length);
      if (!metaPath) {
        throw new Error("Missing metadata path after --meta=.");
      }
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown submit option: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1 || (metaPath && positional.length > 0)) {
    throw new Error("Use one metadata file argument: lml submit [--no-prior-test] --meta=path/to/manifest.yaml");
  }

  return {
    metaPath: resolveMetaArgument(cwd, metaPath ?? positional[0] ?? defaultMetadataPath),
    shouldRunTests
  };
}

function resolveMetaArgument(cwd, metaPath) {
  return isAbsolute(metaPath) ? metaPath : resolve(cwd, metaPath);
}

function isMetadataFile(path) {
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
    throw new Error(`Metadata file must be inside the current repository: ${path}`);
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
