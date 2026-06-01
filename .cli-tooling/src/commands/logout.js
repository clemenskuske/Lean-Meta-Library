import { ensureGitHubCli } from "../lib/github-cli.js";
import { run } from "../lib/process.js";

export async function logout() {
  ensureGitHubCli();
  run("gh", ["auth", "logout", "--hostname", "github.com"], { stdio: "inherit" });
}
