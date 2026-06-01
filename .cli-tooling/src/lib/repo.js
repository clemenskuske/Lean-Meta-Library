import { run } from "./process.js";

const DEFAULT_REPO = "clemenskuske/lean-meta-library";
const DEFAULT_BRANCH = "main";

export function getRepoConfig({ cwd }) {
  return {
    repo: process.env.LML_REPO || parseGitHubRemote(cwd) || DEFAULT_REPO,
    branch: process.env.LML_BRANCH || DEFAULT_BRANCH
  };
}

function parseGitHubRemote(cwd) {
  try {
    const remote = run("git", ["remote", "get-url", "origin"], { cwd });
    const ssh = remote.match(/^git@github\.com:(.+)$/);
    if (ssh) {
      return ssh[1].replace(/\.git$/, "");
    }

    const https = remote.match(/^https:\/\/github\.com\/(.+)$/);
    if (https) {
      return https[1].replace(/\.git$/, "");
    }
  } catch {
    return null;
  }

  return null;
}
