import { ensureAuthenticated } from "../lib/github-auth.js";
import { ensureGitHubCli } from "../lib/github-cli.js";
import { createSubmissionPackage } from "../lib/submission-template.js";

export async function createPaper({ args, cwd }) {
  ensureGitHubCli();
  ensureAuthenticated();

  const slug = args[0] ?? "your-submission-paper";
  const createdPath = createSubmissionPackage({ cwd, slug });
  console.log(`Created submission package at ${createdPath}`);
}
