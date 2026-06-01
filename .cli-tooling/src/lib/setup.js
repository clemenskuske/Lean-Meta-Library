import { ensureAuthenticated } from "./github-auth.js";
import { ensureGitHubCli } from "./github-cli.js";
import { checkLeanAndLake } from "./lean.js";
import { syncRepositoryFiles } from "./sync.js";

export async function runSetup({ cwd, label }) {
  console.log(`Running ${label}.`);
  ensureGitHubCli();
  ensureAuthenticated();
  checkLeanAndLake({ cwd });
  syncRepositoryFiles({ cwd });
  console.log(`${label} complete.`);
}
