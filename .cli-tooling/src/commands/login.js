import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";

export async function login() {
  ensureGitHubCli();
  ensureAuthenticated();
}
